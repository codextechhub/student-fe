import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({
  native: true,
  credentials: new Map<string, string>(),
  unreadable: false,
}));
vi.mock("@/native/platform", () => ({ isNativeApp: () => phone.native, routerBasename: () => "/" }));
vi.mock("@/native/credentials", () => ({
  getCredential: vi.fn(async (account: string) => {
    if (phone.unreadable) throw new Error("locked");
    return phone.credentials.get(account) ?? null;
  }),
  putCredential: vi.fn(async (account: string, refresh: string) => void phone.credentials.set(account, refresh)),
  deleteCredential: vi.fn(async (account: string) => void phone.credentials.delete(account)),
}));

import { accessFor, setAccess } from "./access-tokens";
import { deviceSignOut } from "./device-credential";
import { refreshAccess } from "./refresh";
import { routeFetch } from "./test-fetch";

const REFRESH = "POST /user/auth/device/refresh/";
const SIGN_OUT = "POST /user/auth/device/sign-out/";
const CSRF = "GET /user/auth/csrf/";

beforeEach(() => {
  phone.native = true;
  phone.unreadable = false;
  phone.credentials.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("refreshing in the store app", () => {
  it("sends the stored credential in the body and keeps the rotated one, with no CSRF and no cookies", async () => {
    phone.credentials.set("n-1", "r-old");
    const { calls, fetchMock } = routeFetch({
      [REFRESH]: { status: 200, body: { data: { access: "acc-1", refresh: "r-new", account: "n-1" } } },
    });
    expect(await refreshAccess("n-1")).toEqual({ ok: true, access: "acc-1" });
    const sent = calls.find((c) => c.key === REFRESH)!;
    expect(sent.body).toEqual({ account: "n-1", refresh: "r-old" });
    expect(sent.headers["X-CSRFToken"]).toBeUndefined();
    expect(calls.some((c) => c.key === CSRF)).toBe(false);
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("omit");
    expect(phone.credentials.get("n-1")).toBe("r-new");
    expect(accessFor("n-1")).toBe("acc-1");
  });

  it("ends the pupil, and forgets the credential, when the API says the sign-in is over", async () => {
    phone.credentials.set("n-2", "r-old");
    routeFetch({ [REFRESH]: { status: 401, body: { error: { error_code: "TOKEN_REVOKED" } } } });
    expect(await refreshAccess("n-2")).toEqual({ ok: false, reason: "ended" });
    expect(phone.credentials.has("n-2")).toBe(false);
  });

  it("asks again on a stale answer with the credential still stored, and keeps the pupil", async () => {
    phone.credentials.set("n-3", "r-old");
    let n = 0;
    const { calls } = routeFetch({
      [REFRESH]: () =>
        ++n === 1
          ? { status: 409, body: { error: { error_code: "TOKEN_STALE" } } }
          : { status: 200, body: { data: { access: "acc-3", refresh: "r-3" } } },
    });
    expect(await refreshAccess("n-3")).toEqual({ ok: true, access: "acc-3" });
    expect(calls.filter((c) => c.key === REFRESH).map((c) => (c.body as { refresh: string }).refresh)).toEqual(["r-old", "r-old"]);
    expect(phone.credentials.get("n-3")).toBe("r-3");
  });

  it("treats a pupil with no stored credential as signed out, without calling the API", async () => {
    const { calls } = routeFetch({});
    expect(await refreshAccess("n-4")).toEqual({ ok: false, reason: "ended" });
    expect(calls).toHaveLength(0);
  });

  it("decides nothing when the secure storage cannot be read", async () => {
    phone.credentials.set("n-5", "r-old");
    phone.unreadable = true;
    const { calls } = routeFetch({});
    expect(await refreshAccess("n-5")).toEqual({ ok: false, reason: "server" });
    expect(calls).toHaveLength(0);
    expect(phone.credentials.get("n-5")).toBe("r-old");
  });

  it("keeps the pupil when the school cannot be reached", async () => {
    phone.credentials.set("n-6", "r-old");
    setAccess("n-6", "old");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await refreshAccess("n-6")).toEqual({ ok: false, reason: "offline" });
    expect(phone.credentials.get("n-6")).toBe("r-old");
  });
});

describe("signing out in the store app", () => {
  it("sends the credential in the body, then forgets it", async () => {
    phone.credentials.set("n-7", "r-7");
    phone.credentials.set("n-8", "r-8");
    const { calls } = routeFetch({ [SIGN_OUT]: { status: 200, body: { data: {} } } });
    await deviceSignOut("n-7");
    expect(calls.find((c) => c.key === SIGN_OUT)!.body).toEqual({ account: "n-7", refresh: "r-7" });
    expect(phone.credentials.has("n-7")).toBe(false);
    expect(phone.credentials.get("n-8")).toBe("r-8");
  });
});

describe("the browser is unchanged", () => {
  beforeEach(() => {
    phone.native = false;
  });

  it("refreshes by the account alone, with cookies and the CSRF token", async () => {
    const { calls, fetchMock } = routeFetch({ [REFRESH]: { status: 200, body: { data: { access: "web-1" } } } });
    await refreshAccess("w-1");
    expect(calls.find((c) => c.key === REFRESH)!.body).toEqual({ account: "w-1" });
    expect(calls.find((c) => c.key === REFRESH)!.headers["X-CSRFToken"]).toBe("csrf-test");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.credentials).toBe("include");
  });

  it("signs out by the account alone and touches no secure storage", async () => {
    phone.credentials.set("w-2", "never-used");
    const { calls } = routeFetch({ [SIGN_OUT]: { status: 200, body: { data: {} } } });
    await deviceSignOut("w-2");
    expect(calls.find((c) => c.key === SIGN_OUT)!.body).toEqual({ account: "w-2" });
    expect(phone.credentials.get("w-2")).toBe("never-used");
  });
});
