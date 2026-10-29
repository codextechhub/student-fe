import "fake-indexeddb/auto";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAccess } from "@/auth/access-tokens";
import { keepAnswer, keptAnswer, resetOfflineCopyForTests, wipePupil } from "@/offline/offline-copy";
import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { sessionReducer, sessionSettled } from "@/redux/features/session-slice";

import { baseApi } from "./base-api";

vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => "lagoon-view" }));

const probe = baseApi.injectEndpoints({
  endpoints: (b) => ({
    probeRead: b.query<unknown, void>({ query: () => "/portal/student/probe/" }),
    probeLive: b.query<unknown, void>({ query: () => "/portal/student/probe/live/", extraOptions: { live: true } }),
    probeWrite: b.mutation<unknown, void>({ query: () => ({ url: "/portal/student/probe/", method: "POST", body: {} }) }),
    probeUpload: b.mutation<unknown, void>({
      query: () => ({ url: "/portal/student/probe/photo/", method: "POST", body: new FormData() }),
    }),
  }),
});

function storeFor(account: string) {
  const store = configureStore({
    reducer: { session: sessionReducer, connectivity: connectivityReducer, [baseApi.reducerPath]: baseApi.reducer },
    middleware: (d) => d().concat(baseApi.middleware),
  });
  store.dispatch(sessionSettled({ status: "signed-in", pupils: [], active: account }));
  setAccess(account, `tok-${account}`);
  return store;
}

const offline = () =>
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  }));

beforeEach(async () => {
  resetOfflineCopyForTests();
  await wipePupil("a-bola");
  await wipePupil("a-tunde");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A school that takes the request and never answers it, until the app gives up. */
const silent = () => {
  const fetcher = vi.fn((input: Request | string, init?: RequestInit) => {
    const signal = input instanceof Request ? input.signal : init?.signal;
    return new Promise<Response>((_, reject) => {
      // As a browser does: the fetch fails with the reason the signal gave up.
      signal?.addEventListener("abort", () => reject(signal.reason));
    });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

describe("the offline copy", () => {
  it("keeps what the pupil read, under that pupil", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: "bola's" }), { status: 200 })));
    const store = storeFor("a-bola");
    await store.dispatch(probe.endpoints.probeRead.initiate());
    await vi.waitFor(async () => expect(await keptAnswer("a-bola", "/portal/student/probe/")).not.toBeNull());
    expect(await keptAnswer("a-tunde", "/portal/student/probe/")).toBeNull();
  });

  it("answers from the pupil's own copy when the school can't be reached, and says how old it is", async () => {
    await keepAnswer("a-bola", "/portal/student/probe/", { data: "bola's" }, 1_000);
    await keepAnswer("a-tunde", "/portal/student/probe/", { data: "tunde's" }, 2_000);
    offline();
    const store = storeFor("a-bola");
    const result = await store.dispatch(probe.endpoints.probeRead.initiate());
    expect(result.data).toEqual({ data: "bola's" });
    expect(store.getState().connectivity).toEqual({ offline: true, lastUpdated: 1_000 });
  });

  it("never answers a write from the copy", async () => {
    await keepAnswer("a-bola", "/portal/student/probe/", { data: "bola's" });
    offline();
    const store = storeFor("a-bola");
    const result = await store.dispatch(probe.endpoints.probeWrite.initiate());
    expect("error" in result && result.error).toBeTruthy();
    expect(store.getState().connectivity.offline).toBe(true);
  });

  it("clears the offline bar once the school answers again", async () => {
    await keepAnswer("a-bola", "/portal/student/probe/", { data: "old" }, 1_000);
    offline();
    const store = storeFor("a-bola");
    await store.dispatch(probe.endpoints.probeRead.initiate());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: "new" }), { status: 200 })));
    await store.dispatch(probe.endpoints.probeRead.initiate(undefined, { forceRefetch: true }));
    expect(store.getState().connectivity).toEqual({ offline: false, lastUpdated: null });
  });
});

describe("a live read (a message poll)", () => {
  it("is not kept for offline and is never answered from a copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: "fresh" }), { status: 200 })));
    const store = storeFor("a-bola");
    await store.dispatch(probe.endpoints.probeLive.initiate());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await keptAnswer("a-bola", "/portal/student/probe/live/")).toBeNull();

    await keepAnswer("a-bola", "/portal/student/probe/live/", { data: "old" });
    offline();
    const result = await store.dispatch(probe.endpoints.probeLive.initiate(undefined, { forceRefetch: true }));
    expect("error" in result && result.error).toBeTruthy();
    expect(store.getState().connectivity.offline).toBe(true);
  });

  it("is dropped when a different pupil is showing by the time it answers", async () => {
    let answer: (r: Response) => void = () => {};
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { answer = resolve; }));
    vi.stubGlobal("fetch", fetcher);
    const store = storeFor("a-bola");
    const pending = store.dispatch(probe.endpoints.probeLive.initiate());
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    store.dispatch(sessionSettled({ status: "signed-in", pupils: [], active: "a-tunde" }));
    answer(new Response(JSON.stringify({ data: "bola's" }), { status: 200 }));
    const result = await pending;
    expect(result.data).toBeUndefined();
  });
});

describe("a request the school never answers", () => {
  it("is given up after 45 seconds and answered from the pupil's copy", async () => {
    await keepAnswer("a-bola", "/portal/student/probe/", { data: "bola's" }, 1_000);
    const fetcher = silent();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const store = storeFor("a-bola");
    const pending = store.dispatch(probe.endpoints.probeRead.initiate());
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(45_000);
    const result = await pending;
    expect(result.data).toEqual({ data: "bola's" });
    expect(store.getState().connectivity).toEqual({ offline: true, lastUpdated: 1_000 });
  });

  it("gives an upload two minutes before giving up", async () => {
    document.cookie = "csrftoken=abc; path=/";
    const fetcher = silent();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const store = storeFor("a-bola");
    let settled = false;
    const pending = store.dispatch(probe.endpoints.probeUpload.initiate()).finally(() => { settled = true; });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await pending;
    expect("error" in result && (result.error as { status?: unknown }).status).toBe("TIMEOUT_ERROR");
  });
});
