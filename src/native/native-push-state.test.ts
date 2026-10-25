/**
 * Native push on the shared phone of Ebere and Femi, who both attend the same
 * school and sign in on their mother's phone. Each is registered with the
 * school under their own sign-in, only after choosing notifications, and a
 * school that sends no phone push is never an error on screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({
  permission: "prompt" as "granted" | "denied" | "prompt",
  answer: "granted" as "granted" | "denied" | "prompt",
  token: "fcm-token-1",
  ask: vi.fn(),
  tokenFails: false,
}));
vi.mock("./platform", () => ({
  isNativeApp: () => true,
  nativePlatform: () => "android",
  isDebugBuild: () => false,
}));
vi.mock("./app-version", () => ({ APP_ID: "com.codexng.xvs.student", installedVersion: async () => "1.0.3" }));
vi.mock("./push-device", () => ({
  osPermission: async () => phone.permission,
  askOsPermission: async () => {
    phone.ask();
    phone.permission = phone.answer;
    return phone.answer;
  },
  deviceToken: async () => {
    if (phone.tokenFails) throw new Error("no token");
    return phone.token;
  },
}));

import { setAccess } from "@/auth/access-tokens";
import { routeFetch } from "@/auth/test-fetch";
import { pushChoiceFor, setPushChoice } from "@/push/push-choice";

import {
  nativePushState,
  notNow,
  readPermission,
  resetNativePushState,
  syncPupils,
  turnOff,
  turnOn,
} from "./native-push-state";
import { forgetPupilDevice } from "./push-register";

const DEVICES_POST = "POST /notify/push/devices/";
const DEVICES_DELETE = "DELETE /notify/push/devices/";
const CREATED = { status: 201, body: { message: "Notifications are on for this device." } };

beforeEach(() => {
  localStorage.clear();
  resetNativePushState();
  phone.permission = "prompt";
  phone.answer = "granted";
  phone.token = "fcm-token-1";
  phone.tokenFails = false;
  phone.ask.mockReset();
  setAccess("a-ebere", "access-ebere");
  setAccess("a-femi", "access-femi");
});
afterEach(() => vi.unstubAllGlobals());

describe("turning notifications on", () => {
  it("asks the phone, then registers the token for the pupil under their own sign-in", async () => {
    const { calls } = routeFetch({ [DEVICES_POST]: CREATED });
    expect(await turnOn("a-ebere")).toEqual({ ok: true });
    expect(phone.ask).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({
      token: "fcm-token-1",
      platform: "android",
      app: "com.codexng.xvs.student",
      app_version: "1.0.3",
      account: "a-ebere",
    });
    expect(calls[0].headers.Authorization).toBe("Bearer access-ebere");
    expect(pushChoiceFor("a-ebere")).toBe("on");
  });

  it("does not ask again when the phone already allows notifications", async () => {
    phone.permission = "granted";
    routeFetch({ [DEVICES_POST]: CREATED });
    await turnOn("a-femi");
    expect(phone.ask).not.toHaveBeenCalled();
  });

  it("stops at a refusal by the phone, sends nothing and says it is blocked", async () => {
    phone.answer = "denied";
    const { calls } = routeFetch({ [DEVICES_POST]: CREATED });
    expect(await turnOn("a-ebere")).toEqual({ ok: false, reason: "blocked" });
    expect(calls).toHaveLength(0);
    expect(pushChoiceFor("a-ebere")).toBeNull();
    await readPermission();
    expect(nativePushState({ permission: "denied", unavailable: false, choice: null })).toBe("blocked");
  });

  it("treats a school that sends no phone push as unavailable, without an error, and puts the offer away", async () => {
    routeFetch({ [DEVICES_POST]: { status: 503, body: { error: { code: "PUSH_NOT_CONFIGURED" } } } });
    expect(await turnOn("a-ebere")).toEqual({ ok: false, reason: "unavailable" });
    expect(pushChoiceFor("a-ebere")).toBe("not-now");
    expect(nativePushState({ permission: "granted", unavailable: true, choice: "not-now" })).toBe("unavailable");
  });

  it("reports any other refusal or lost connection as a failure and keeps the pupil undecided", async () => {
    routeFetch({ [DEVICES_POST]: { status: 503, body: {} } });
    expect(await turnOn("a-ebere")).toEqual({ ok: false, reason: "failed" });
    expect(pushChoiceFor("a-ebere")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await turnOn("a-ebere")).toEqual({ ok: false, reason: "failed" });
    phone.tokenFails = true;
    expect(await turnOn("a-ebere")).toEqual({ ok: false, reason: "failed" });
  });
});

describe("registering every pupil on the phone", () => {
  it("registers each pupil who turned notifications on, each with their own sign-in", async () => {
    phone.permission = "granted";
    setPushChoice("a-ebere", "on");
    setPushChoice("a-femi", "on");
    const { calls } = routeFetch({ [DEVICES_POST]: CREATED });
    await syncPupils(["a-ebere", "a-femi"]);
    expect(calls.map((c) => [(c.body as { account: string }).account, c.headers.Authorization])).toEqual([
      ["a-ebere", "Bearer access-ebere"],
      ["a-femi", "Bearer access-femi"],
    ]);
  });

  it("leaves out a pupil who has not chosen, or said off or not now", async () => {
    phone.permission = "granted";
    setPushChoice("a-ebere", "off");
    const { calls } = routeFetch({ [DEVICES_POST]: CREATED });
    await syncPupils(["a-ebere", "a-femi"]);
    setPushChoice("a-femi", "not-now");
    await syncPupils(["a-ebere", "a-femi"]);
    expect(calls).toHaveLength(0);
  });

  it("sends nothing while the phone's permission is not given", async () => {
    setPushChoice("a-ebere", "on");
    const { calls } = routeFetch({ [DEVICES_POST]: CREATED });
    await syncPupils(["a-ebere"]);
    expect(calls).toHaveLength(0);
  });

  it("sends an unchanged token once, and every pupil again when the token changes", async () => {
    phone.permission = "granted";
    setPushChoice("a-ebere", "on");
    setPushChoice("a-femi", "on");
    const { calls } = routeFetch({ [DEVICES_POST]: CREATED });
    await syncPupils(["a-ebere", "a-femi"]);
    await syncPupils(["a-ebere", "a-femi"]);
    expect(calls).toHaveLength(2);
    await syncPupils(["a-ebere", "a-femi"], "fcm-token-2");
    expect(calls).toHaveLength(4);
    expect(calls.slice(2).map((c) => (c.body as { token: string }).token)).toEqual(["fcm-token-2", "fcm-token-2"]);
  });

  it("registers a pupil added later without sending the others again", async () => {
    phone.permission = "granted";
    setPushChoice("a-ebere", "on");
    const { calls } = routeFetch({ [DEVICES_POST]: CREATED });
    await syncPupils(["a-ebere"]);
    setPushChoice("a-femi", "on");
    await syncPupils(["a-ebere", "a-femi"]);
    expect(calls.map((c) => (c.body as { account: string }).account)).toEqual(["a-ebere", "a-femi"]);
  });

  it("stops quietly, and does not try the rest, once the school says it sends no phone push", async () => {
    phone.permission = "granted";
    setPushChoice("a-ebere", "on");
    setPushChoice("a-femi", "on");
    const { calls } = routeFetch({ [DEVICES_POST]: { status: 503, body: { error: { code: "PUSH_NOT_CONFIGURED" } } } });
    await expect(syncPupils(["a-ebere", "a-femi"])).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    await syncPupils(["a-ebere", "a-femi"]);
    expect(calls).toHaveLength(1);
  });

  it("tries a pupil whose request failed again next time", async () => {
    phone.permission = "granted";
    setPushChoice("a-ebere", "on");
    let answer: { status: number; body: unknown } = { status: 500, body: {} };
    const { calls } = routeFetch({ [DEVICES_POST]: () => answer });
    await syncPupils(["a-ebere"]);
    answer = CREATED;
    await syncPupils(["a-ebere"]);
    expect(calls).toHaveLength(2);
  });
});

describe("turning notifications off and signing out", () => {
  it("forgets the phone for this pupil only, and remembers the choice", async () => {
    setPushChoice("a-ebere", "on");
    setPushChoice("a-femi", "on");
    const { calls } = routeFetch({ [DEVICES_DELETE]: { status: 200 } });
    await turnOff("a-ebere");
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ token: "fcm-token-1" });
    expect(calls[0].headers.Authorization).toBe("Bearer access-ebere");
    expect(pushChoiceFor("a-ebere")).toBe("off");
    expect(pushChoiceFor("a-femi")).toBe("on");
  });

  it("asks the school to forget the phone on the way out, and never fails a sign-out", async () => {
    const { calls } = routeFetch({ [DEVICES_DELETE]: { status: 200 } });
    await forgetPupilDevice("a-femi");
    expect(calls).toHaveLength(1);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(forgetPupilDevice("a-femi")).resolves.toBeUndefined();
    phone.tokenFails = true;
    await expect(forgetPupilDevice("a-femi")).resolves.toBeUndefined();
  });
});

describe("a refusal is remembered", () => {
  it("does not offer notifications again to a pupil who said not now", () => {
    notNow("a-ebere");
    expect(pushChoiceFor("a-ebere")).toBe("not-now");
    expect(nativePushState({ permission: "prompt", unavailable: false, choice: "not-now" })).toBe("off");
    expect(nativePushState({ permission: "prompt", unavailable: false, choice: null })).toBe("undecided");
  });
});

describe("where notifications stand", () => {
  const base = { permission: "granted" as const, unavailable: false, choice: null };

  it("waits until the phone's permission has been read", () => {
    expect(nativePushState({ ...base, permission: "unknown" })).toBe("loading");
  });

  it("reads a pupil's own choice, with an on whose permission was withdrawn as off", () => {
    expect(nativePushState({ ...base, choice: "on" })).toBe("on");
    expect(nativePushState({ ...base, permission: "prompt", choice: "on" })).toBe("off");
    expect(nativePushState({ ...base, choice: "off" })).toBe("off");
  });

  it("says blocked when the phone has been told no, whatever the pupil chose", () => {
    expect(nativePushState({ ...base, permission: "denied", choice: "on" })).toBe("blocked");
  });
});
