import { afterEach, describe, expect, it, vi } from "vitest";

import { accessFor, setAccess } from "./access-tokens";
import { refreshAccess } from "./refresh";
import { routeFetch } from "./test-fetch";

const REFRESH = "POST /user/auth/device/refresh/";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("refreshAccess", () => {
  it("sends one refresh for callers in the same tab and gives each the new token", async () => {
    const { calls } = routeFetch({ [REFRESH]: { status: 200, body: { data: { access: "new-1" } } } });
    const [a, b] = await Promise.all([refreshAccess("acct-1"), refreshAccess("acct-1")]);
    expect(a).toEqual({ ok: true, access: "new-1" });
    expect(b).toEqual({ ok: true, access: "new-1" });
    expect(calls.filter((c) => c.key === REFRESH)).toHaveLength(1);
    expect(accessFor("acct-1")).toBe("new-1");
  });

  it("queues on a Web Lock named for the pupil, so other windows wait their turn", async () => {
    routeFetch({ [REFRESH]: { status: 200, body: { data: { access: "new-2" } } } });
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal("navigator", { locks: { request } });
    await refreshAccess("acct-2");
    expect(request).toHaveBeenCalledWith("refresh:acct-2", expect.any(Function));
  });

  it("asks again once when another window refreshed first, and keeps the pupil", async () => {
    let n = 0;
    const { calls } = routeFetch({
      [REFRESH]: () =>
        ++n === 1
          ? { status: 409, body: { error: { error_code: "TOKEN_STALE" } } }
          : { status: 200, body: { data: { access: "new-3" } } },
    });
    expect(await refreshAccess("acct-3")).toEqual({ ok: true, access: "new-3" });
    expect(calls.filter((c) => c.key === REFRESH)).toHaveLength(2);
  });

  it("ends the pupil only when the API says the sign-in is over", async () => {
    setAccess("acct-4", "old");
    routeFetch({ [REFRESH]: { status: 401, body: { error: { error_code: "TOKEN_REVOKED" } } } });
    expect(await refreshAccess("acct-4")).toEqual({ ok: false, reason: "ended" });
    expect(accessFor("acct-4")).toBe("");
  });

  it("keeps the pupil when the school cannot be reached", async () => {
    setAccess("acct-5", "old");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    expect(await refreshAccess("acct-5")).toEqual({ ok: false, reason: "offline" });
    expect(accessFor("acct-5")).toBe("old");
  });

  it("refreshes two pupils independently", async () => {
    const { calls } = routeFetch({
      [REFRESH]: (body) => ({ status: 200, body: { data: { access: `tok-${(body as { account: string }).account}` } } }),
    });
    await Promise.all([refreshAccess("tunde"), refreshAccess("bola")]);
    expect(accessFor("tunde")).toBe("tok-tunde");
    expect(accessFor("bola")).toBe("tok-bola");
    expect(calls.filter((c) => c.key === REFRESH)).toHaveLength(2);
  });
});
