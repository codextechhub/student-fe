/**
 * Notifications for Ebere and Femi, who share their mother's phone.
 *
 * Turning them on asks the browser first and then tells the school about this
 * phone's one subscription, for the pupil showing. Turning them off tells the
 * school to stop for that pupil only and never cancels the browser's
 * subscription, which Femi still uses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ sent: [] as Array<{ endpoint: string; args: unknown }> }));

vi.mock("@/redux/services/push-api", () => {
  const endpoint = (name: string) => ({ initiate: (args?: unknown) => ({ name, args }) });
  return {
    pushApi: {
      endpoints: {
        pushKey: endpoint("pushKey"),
        subscribePush: endpoint("subscribePush"),
        unsubscribePush: endpoint("unsubscribePush"),
      },
    },
  };
});

import { pushChoiceFor, setPushChoice } from "./push-choice";
import { keyBytes, refreshPush, routerPath, turnOffPush, turnOnPush } from "./push";
import { pushStateFrom } from "./use-push";

/** The school's key, as `GET /notify/push/key/` sends it. */
const SCHOOL_KEY = "BAECAwQ";
const OTHER_KEY = "BAkICAk";

type FakeSubscription = {
  endpoint: string;
  options: { applicationServerKey: ArrayBuffer };
  unsubscribe: ReturnType<typeof vi.fn>;
  toJSON: () => { endpoint: string; keys: { p256dh: string; auth: string } };
};

function fakeSubscription(endpoint: string, key: string): FakeSubscription {
  return {
    endpoint,
    options: { applicationServerKey: keyBytes(key).buffer },
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({ endpoint, keys: { p256dh: "p-key", auth: "a-key" } }),
  };
}

let existing: FakeSubscription | null;
let permission: NotificationPermission;
let answer: NotificationPermission;
const subscribe = vi.fn();

const dispatch = vi.fn((action: { name: string; args: unknown }) => {
  calls.sent.push({ endpoint: action.name, args: action.args });
  return { unwrap: async () => (action.name === "pushKey" ? SCHOOL_KEY : undefined) };
}) as never;

beforeEach(() => {
  calls.sent = [];
  existing = null;
  permission = "default";
  answer = "granted";
  localStorage.clear();
  subscribe.mockReset().mockImplementation(async () => {
    existing = fakeSubscription("https://push.example/new", SCHOOL_KEY);
    return existing;
  });
  vi.stubGlobal("Notification", {
    get permission() { return permission; },
    requestPermission: vi.fn(async () => { permission = answer; return answer; }),
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => existing, subscribe } }) },
  });
});
afterEach(() => vi.unstubAllGlobals());

const sent = (endpoint: string) => calls.sent.filter((c) => c.endpoint === endpoint).map((c) => c.args);

describe("turning notifications on", () => {
  it("asks the browser, subscribes under the school's key and tells the school which pupil", async () => {
    expect(await turnOnPush(dispatch, "a-ebere")).toEqual({ ok: true });
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes(SCHOOL_KEY) });
    expect(sent("subscribePush")).toEqual([
      { endpoint: "https://push.example/new", keys: { p256dh: "p-key", auth: "a-key" }, account: "a-ebere" },
    ]);
    expect(pushChoiceFor("a-ebere")).toBe("on");
  });

  it("reuses the phone's subscription for a second pupil", async () => {
    existing = fakeSubscription("https://push.example/shared", SCHOOL_KEY);
    await turnOnPush(dispatch, "a-femi");
    expect(subscribe).not.toHaveBeenCalled();
    expect(sent("subscribePush")).toEqual([expect.objectContaining({ endpoint: "https://push.example/shared", account: "a-femi" })]);
  });

  it("replaces a subscription made under a key the school no longer uses", async () => {
    const old = fakeSubscription("https://push.example/old", OTHER_KEY);
    existing = old;
    await turnOnPush(dispatch, "a-ebere");
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(sent("subscribePush")).toEqual([expect.objectContaining({ endpoint: "https://push.example/new" })]);
  });

  it("stops at a refusal, and tells the school nothing", async () => {
    answer = "denied";
    expect(await turnOnPush(dispatch, "a-ebere")).toEqual({ ok: false, reason: "blocked" });
    answer = "default";
    expect(await turnOnPush(dispatch, "a-ebere")).toEqual({ ok: false, reason: "dismissed" });
    expect(calls.sent).toEqual([]);
    expect(pushChoiceFor("a-ebere")).toBeNull();
  });
});

describe("turning notifications off", () => {
  it("stops them for this pupil only and keeps the browser's subscription for the sibling", async () => {
    existing = fakeSubscription("https://push.example/shared", SCHOOL_KEY);
    setPushChoice("a-ebere", "on");
    setPushChoice("a-femi", "on");
    expect(await turnOffPush(dispatch, "a-ebere")).toBe(true);
    expect(sent("unsubscribePush")).toEqual([{ endpoint: "https://push.example/shared" }]);
    expect(existing.unsubscribe).not.toHaveBeenCalled();
    expect(pushChoiceFor("a-ebere")).toBe("off");
    expect(pushChoiceFor("a-femi")).toBe("on");
  });
});

describe("re-sending on open", () => {
  it("re-sends the subscription for a pupil who turned notifications on", async () => {
    permission = "granted";
    existing = fakeSubscription("https://push.example/shared", SCHOOL_KEY);
    setPushChoice("a-femi", "on");
    await refreshPush(dispatch, "a-femi");
    expect(sent("subscribePush")).toEqual([expect.objectContaining({ account: "a-femi" })]);
  });

  it("sends nothing for a pupil who did not, or once the browser's permission is gone", async () => {
    permission = "granted";
    setPushChoice("a-ebere", "off");
    await refreshPush(dispatch, "a-ebere");
    setPushChoice("a-femi", "on");
    permission = "default";
    await refreshPush(dispatch, "a-femi");
    expect(calls.sent).toEqual([]);
  });
});

describe("where things stand", () => {
  const base = { support: "ready" as const, keyState: "ready" as const, permission: "default" as const, choice: null };

  it("offers notifications to a pupil not yet asked", () => {
    expect(pushStateFrom(base)).toBe("undecided");
  });

  it("offers nothing where the school sends none, or the browser cannot show them", () => {
    expect(pushStateFrom({ ...base, keyState: "missing" })).toBe("unavailable");
    expect(pushStateFrom({ ...base, support: "unsupported" })).toBe("unavailable");
  });

  it("waits for the installed app on an iPhone", () => {
    expect(pushStateFrom({ ...base, support: "install-first" })).toBe("install-first");
  });

  it("says when the browser has blocked them", () => {
    expect(pushStateFrom({ ...base, permission: "denied", choice: "on" })).toBe("blocked");
  });

  it("reads a pupil's own choice, and an on whose permission was withdrawn as off", () => {
    expect(pushStateFrom({ ...base, permission: "granted", choice: "on" })).toBe("on");
    expect(pushStateFrom({ ...base, choice: "on" })).toBe("off");
    expect(pushStateFrom({ ...base, choice: "not-now" })).toBe("off");
  });
});

describe("addresses", () => {
  it("opens a screen inside the app, and the app's home for anything else", () => {
    expect(routerPath("/student/results")).toBe("/results");
    expect(routerPath("/student/")).toBe("/");
    expect(routerPath("/student/fees/receipts/77")).toBe("/fees/receipts/77");
    expect(routerPath("/overview")).toBe("/");
    expect(routerPath("https://elsewhere.example/student/")).toBe("/");
  });

  it("reads the school's key as bytes", () => {
    expect([...keyBytes(SCHOOL_KEY)]).toEqual([4, 1, 2, 3, 4]);
  });
});
