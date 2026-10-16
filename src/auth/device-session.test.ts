import "fake-indexeddb/auto";
import { configureStore, type Middleware, type UnknownAction } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sessionReducer } from "@/redux/features/session-slice";
import { baseApi } from "@/redux/services/base-api";

import { accessFor, dropAccess } from "./access-tokens";
import { bootSession, HANDOVER_KEY, signInPupil, signOutPupil, switchPupil } from "./device-session";
import { deletePupil, listPupils, putPupil, resetPupilsStoreForTests, setActiveAccount } from "./pupils-store";
import { routeFetch } from "./test-fetch";

vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => "lagoon-view" }));

/** `me/` for each device account the tests use, by bearer token. */
const PUPILS: Record<string, { id: number; first: string; full: string }> = {
  "a-ebere": { id: 427, first: "Ebere", full: "Ebere Bello" },
  "a-femi": { id: 428, first: "Femi", full: "Femi Bello" },
  "a-ebere-2": { id: 427, first: "Ebere", full: "Ebere Bello" },
};

function meAnswer(token: string) {
  const account = token.replace(/^tok-/, "");
  const pupil = PUPILS[account];
  if (!pupil) return { status: 404 };
  return {
    status: 200,
    body: {
      data: {
        student: { id: pupil.id, first_name: pupil.first, full_name: pupil.full, photo_url: "" },
        school: { name: "Lagoon View Academy", logo_url: "" },
      },
    },
  };
}

/** Routes the session calls; `ended` lists accounts whose refresh is refused for good. */
function api(ended: string[] = []) {
  const routed = routeFetch({
    "POST /user/auth/device/refresh/": (body) => {
      const account = (body as { account: string }).account;
      return ended.includes(account)
        ? { status: 401, body: { error: { error_code: "TOKEN_EXPIRED" } } }
        : { status: 200, body: { data: { access: `tok-${account}` } } };
    },
    "POST /user/auth/device/sign-out/": { status: 200, body: { data: {} } },
  });
  // me/ needs the bearer token, which the router's body-only handlers cannot see.
  const inner = routed.fetchMock.getMockImplementation()!;
  routed.fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/portal/student/me/")) {
      const token = new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? "";
      const answer = meAnswer(token);
      routed.calls.push({ key: "GET /portal/student/me/", body: undefined, headers: { authorization: token } });
      return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status });
    }
    return inner(input, init);
  });
  return routed;
}

function makeStore() {
  const seen: UnknownAction[] = [];
  const record: Middleware = () => (next) => (action) => {
    seen.push(action as UnknownAction);
    return next(action);
  };
  const store = configureStore({
    reducer: { session: sessionReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (d) => d().prepend(record).concat(baseApi.middleware),
  });
  return { store, seen };
}

beforeEach(async () => {
  resetPupilsStoreForTests();
  for (const p of await listPupils()) await deletePupil(p.account);
  await setActiveAccount(null);
  for (const account of Object.keys(PUPILS)) dropAccess(account);
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const pupil = (account: string) => ({
  account,
  studentId: PUPILS[account].id,
  fullName: PUPILS[account].full,
  firstName: PUPILS[account].first,
  photo: "",
});

describe("opening the app", () => {
  it("opens the pupil used last and keeps the others on the phone", async () => {
    api();
    await putPupil(pupil("a-ebere"));
    await putPupil(pupil("a-femi"));
    await setActiveAccount("a-femi");
    const { store } = makeStore();
    await store.dispatch(bootSession());
    const { status, active, pupils } = store.getState().session;
    expect(status).toBe("signed-in");
    expect(active).toBe("a-femi");
    expect(pupils).toHaveLength(2);
  });

  it("takes a pupil whose sign-in has ended off the phone, says so, and opens the next", async () => {
    api(["a-femi"]);
    await putPupil(pupil("a-femi"));
    await putPupil(pupil("a-ebere"));
    await setActiveAccount("a-femi");
    const { store } = makeStore();
    await store.dispatch(bootSession());
    const session = store.getState().session;
    expect(session.active).toBe("a-ebere");
    expect(session.pupils.map((p) => p.account)).toEqual(["a-ebere"]);
    expect(session.notice).toContain("Femi was signed out on this phone");
  });

  it("signs nobody out when the school cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await putPupil(pupil("a-ebere"));
    const { store } = makeStore();
    await store.dispatch(bootSession());
    expect(store.getState().session.status).toBe("unreachable");
    expect(await listPupils()).toHaveLength(1);
  });

  it("takes over a sign-in school-fe handed across", async () => {
    api();
    sessionStorage.setItem(HANDOVER_KEY, "a-femi");
    const { store } = makeStore();
    await store.dispatch(bootSession());
    expect(store.getState().session.active).toBe("a-femi");
    expect(sessionStorage.getItem(HANDOVER_KEY)).toBeNull();
    expect((await listPupils())[0].firstName).toBe("Femi");
  });
});

describe("switching and signing out", () => {
  it("throws away the last pupil's reads before the next pupil is showing", async () => {
    api();
    await putPupil(pupil("a-ebere"));
    await putPupil(pupil("a-femi"));
    const { store, seen } = makeStore();
    await store.dispatch(bootSession());
    seen.length = 0;
    await store.dispatch(switchPupil("a-femi"));
    const reset = seen.findIndex((a) => a.type === baseApi.util.resetApiState.type);
    const shown = seen.findIndex(
      (a) => a.type === "session/sessionSettled" && (a.payload as { active: string }).active === "a-femi",
    );
    expect(reset).toBeGreaterThanOrEqual(0);
    expect(shown).toBeGreaterThan(reset);
    // No request starts in between: one would be the last pupil's, refetched
    // into the cache the next pupil's screen reads. (RTK Query's own
    // bookkeeping after a reset is allowed.)
    const between = seen.slice(reset + 1, shown).map((a) => a.type);
    expect(between.filter((type) => /execute(Query|Mutation)/.test(type))).toEqual([]);
  });

  it("drops an answer that arrives after the pupil showing changed", async () => {
    api();
    await putPupil(pupil("a-ebere"));
    await putPupil(pupil("a-femi"));
    await setActiveAccount("a-ebere");
    const { store } = makeStore();
    await store.dispatch(bootSession());

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const inner = (fetch as unknown as { getMockImplementation: () => typeof fetch }).getMockImplementation();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/portal/student/results/")) {
          await gate;
          return new Response(JSON.stringify({ data: { owner: "ebere" } }), { status: 200 });
        }
        return inner(input as RequestInfo, init);
      }),
    );
    const slow = baseApi.injectEndpoints({
      endpoints: (b) => ({ slowResults: b.query<unknown, void>({ query: () => "/portal/student/results/" }) }),
      overrideExisting: true,
    });

    const pending = store.dispatch(slow.endpoints.slowResults.initiate());
    await store.dispatch(switchPupil("a-femi"));
    release();
    const result = await pending;
    expect(result.data).toBeUndefined();
    expect(JSON.stringify(store.getState().api.queries)).not.toContain("ebere");
  });

  it("signing one pupil out leaves the other signed in and showing", async () => {
    const { calls } = api();
    await putPupil(pupil("a-ebere"));
    await putPupil(pupil("a-femi"));
    await setActiveAccount("a-ebere");
    const { store } = makeStore();
    await store.dispatch(bootSession());
    await store.dispatch(signOutPupil("a-ebere"));
    const session = store.getState().session;
    expect(session.active).toBe("a-femi");
    expect(session.pupils.map((p) => p.account)).toEqual(["a-femi"]);
    expect(accessFor("a-ebere")).toBe("");
    expect(calls.find((c) => c.key === "POST /user/auth/device/sign-out/")?.body).toEqual({ account: "a-ebere" });
  });

  it("the last pupil signing out goes to the sign-in screen", async () => {
    api();
    await putPupil(pupil("a-ebere"));
    const { store } = makeStore();
    await store.dispatch(bootSession());
    await store.dispatch(signOutPupil("a-ebere"));
    expect(store.getState().session.status).toBe("signed-out");
  });
});

describe("signing in", () => {
  it("the same child signing in again replaces their old entry rather than listing them twice", async () => {
    const { calls, fetchMock } = api();
    const inner = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).includes("/user/auth/login/")) {
        calls.push({ key: "POST /user/auth/login/", body: JSON.parse(String(init?.body)), headers: {} });
        return new Response(JSON.stringify({ data: { account: "a-ebere-2", access: "tok-a-ebere-2" } }), { status: 200 });
      }
      return inner(input, init);
    });
    await putPupil(pupil("a-ebere"));
    const { store } = makeStore();
    await store.dispatch(bootSession());
    const result = await store.dispatch(signInPupil("LV/2026/0029", "secret"));
    expect(result).toEqual({ ok: true });
    expect((await listPupils()).map((p) => p.account)).toEqual(["a-ebere-2"]);
    expect(calls.find((c) => c.key === "POST /user/auth/login/")?.body).toMatchObject({
      identifier: "LV/2026/0029",
      tenant: "lagoon-view",
      session: "device",
    });
    expect(calls.some((c) => c.key === "POST /user/auth/device/sign-out/" && (c.body as { account: string }).account === "a-ebere")).toBe(true);
  });

  it("turns a staff account away with a pointer to the school's sign-in", async () => {
    routeFetch({
      "POST /user/auth/login/": { status: 403, body: { error: { code: "DEVICE_SESSION_NOT_OFFERED" } } },
    });
    const { store } = makeStore();
    const result = await store.dispatch(signInPupil("teacher@lagoon-view.example.com", "secret"));
    expect(result).toMatchObject({ ok: false, staff: true });
  });

  it("says plainly when the details do not match", async () => {
    routeFetch({
      "POST /user/auth/login/": { status: 401, body: { error: { code: "INVALID_CREDENTIALS" } } },
    });
    const { store } = makeStore();
    const result = await store.dispatch(signInPupil("LV/2026/0029", "wrong"));
    expect(result).toEqual({
      ok: false,
      message: "That admission number or email and password don't match. Check them and try again.",
    });
  });
});
