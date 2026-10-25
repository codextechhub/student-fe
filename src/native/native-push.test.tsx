/**
 * The store app's push listener on Ebere and Femi's shared phone: a tapped
 * notification switches to the pupil it names and opens its screen, the offer
 * comes before the phone's own prompt, and an open Android app shows a toast.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: "android" as "android" | "ios",
  session: {
    status: "signed-in",
    active: "a-ebere" as string | null,
    pupils: [
      { account: "a-ebere", firstName: "Ebere" },
      { account: "a-femi", firstName: "Femi" },
    ],
  },
  offline: false,
  navigate: vi.fn(),
  onPhone: ["a-ebere", "a-femi"] as string[],
  shown: vi.fn(),
  tap: null as null | ((payload: unknown) => void),
  foreground: null as null | ((payload: unknown) => void),
  token: null as null | ((token: string) => void),
  toast: vi.fn(),
  register: vi.fn(),
  permission: "prompt" as "granted" | "denied" | "prompt",
}));
vi.mock("react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("sonner", () => ({ toast: Object.assign(mocks.toast, { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => async (action: { account: string }) => {
    mocks.shown(action.account);
    return mocks.onPhone.includes(action.account);
  },
  useAppSelector: (pick: (s: unknown) => unknown) => pick({ session: mocks.session, connectivity: { offline: mocks.offline } }),
}));
vi.mock("@/auth/device-session", () => ({ showPupilFromPush: (account: string) => ({ account }) }));
vi.mock("./platform", () => ({
  isNativeApp: () => true,
  nativePlatform: () => mocks.platform,
  isDebugBuild: () => false,
}));
vi.mock("./push-device", () => ({
  osPermission: async () => mocks.permission,
  askOsPermission: async () => "granted",
  deviceToken: async () => "fcm-token",
  onTokenChange: async (listener: (token: string) => void) => {
    mocks.token = listener;
    return () => undefined;
  },
  onTap: async (listener: (payload: unknown) => void) => {
    mocks.tap = listener;
    return () => undefined;
  },
  onForeground: async (listener: (payload: unknown) => void) => {
    mocks.foreground = listener;
    return () => undefined;
  },
}));
vi.mock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: async () => undefined }) } }));
vi.mock("./push-register", async () => ({
  registerPupil: (account: string, token: string) => {
    mocks.register(account, token);
    return "ok";
  },
  forgetPupilDevice: vi.fn(async () => undefined),
}));

import { pushChoiceFor, setPushChoice } from "@/push/push-choice";

import { NativePushListener } from "./native-push";
import { resetNativePushState } from "./native-push-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  localStorage.clear();
  resetNativePushState();
  mocks.platform = "android";
  mocks.session = {
    status: "signed-in",
    active: "a-ebere",
    pupils: [
      { account: "a-ebere", firstName: "Ebere" },
      { account: "a-femi", firstName: "Femi" },
    ],
  };
  mocks.offline = false;
  mocks.onPhone = ["a-ebere", "a-femi"];
  mocks.permission = "prompt";
  mocks.navigate.mockReset();
  mocks.shown.mockReset();
  mocks.toast.mockReset();
  mocks.register.mockReset();
  mocks.tap = null;
  mocks.foreground = null;
  setPushChoice("a-ebere", "off");
  setPushChoice("a-femi", "off");
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = async () => {
  await act(async () => root.render(<NativePushListener />));
  await act(async () => undefined);
};
const tap = async (data: Record<string, unknown>) => {
  await act(async () => mocks.tap!({ title: "", body: "", data }));
};

describe("a tapped notification", () => {
  it("shows the pupil it names and opens its screen without the /student prefix", async () => {
    await mount();
    await tap({ url: "/student/messages/41", account: "a-femi" });
    expect(mocks.shown).toHaveBeenCalledWith("a-femi");
    expect(mocks.navigate).toHaveBeenCalledWith("/messages/41");
  });

  it("opens the app normally for a pupil no longer on the phone", async () => {
    mocks.onPhone = ["a-ebere"];
    await mount();
    await tap({ url: "/student/messages/41", account: "a-gone" });
    expect(mocks.shown).toHaveBeenCalledWith("a-gone");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("opens the screen in the pupil showing when the notification names no pupil", async () => {
    await mount();
    await tap({ url: "/student/notices" });
    expect(mocks.shown).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/notices");
  });

  it("never follows an address outside the student app", async () => {
    await mount();
    await tap({ url: "https://evil.example/student/fees", account: "a-ebere" });
    expect(mocks.navigate).toHaveBeenCalledWith("/");
  });

  it("waits for a launching tap until the session has opened, then follows it", async () => {
    mocks.session = { ...mocks.session, status: "booting" };
    await mount();
    await tap({ url: "/student/fees", account: "a-femi" });
    expect(mocks.navigate).not.toHaveBeenCalled();
    mocks.session = { ...mocks.session, status: "signed-in" };
    await mount();
    expect(mocks.shown).toHaveBeenCalledWith("a-femi");
    expect(mocks.navigate).toHaveBeenCalledWith("/fees");
  });

  it("drops a launching tap when nobody can be signed in", async () => {
    mocks.session = { ...mocks.session, status: "booting" };
    await mount();
    await tap({ url: "/student/fees", account: "a-femi" });
    mocks.session = { status: "signed-out", active: null, pupils: [] };
    await mount();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe("registering the phone", () => {
  it("registers every pupil who has notifications on at start, and again when the token changes", async () => {
    mocks.permission = "granted";
    setPushChoice("a-ebere", "on");
    setPushChoice("a-femi", "on");
    await mount();
    expect(mocks.register.mock.calls).toEqual([["a-ebere", "fcm-token"], ["a-femi", "fcm-token"]]);
    await act(async () => mocks.token!("fcm-token-new"));
    expect(mocks.register.mock.calls.slice(2)).toEqual([["a-ebere", "fcm-token-new"], ["a-femi", "fcm-token-new"]]);
  });

  it("registers a pupil who signs in later", async () => {
    mocks.permission = "granted";
    setPushChoice("a-ebere", "on");
    mocks.session = { ...mocks.session, pupils: [{ account: "a-ebere", firstName: "Ebere" }] };
    await mount();
    expect(mocks.register.mock.calls).toEqual([["a-ebere", "fcm-token"]]);
    setPushChoice("a-femi", "on");
    mocks.session = { ...mocks.session, pupils: [{ account: "a-ebere", firstName: "Ebere" }, { account: "a-femi", firstName: "Femi" }] };
    await mount();
    expect(mocks.register.mock.calls).toEqual([["a-ebere", "fcm-token"], ["a-femi", "fcm-token"]]);
  });
});

describe("an open app", () => {
  it("shows a toast for a notification on Android, where the system shows none", async () => {
    await mount();
    await act(async () => mocks.foreground!({ title: "Femi: A new notice", body: "Open the app to read it.", data: {} }));
    expect(mocks.toast).toHaveBeenCalledWith("Femi: A new notice", { description: "Open the app to read it." });
  });

  it("leaves the banner to the iPhone", async () => {
    mocks.platform = "ios";
    await mount();
    expect(mocks.foreground).toBeNull();
  });
});

describe("the offer", () => {
  it("explains before the phone asks, and Not now is remembered", async () => {
    setPushChoice("a-ebere", null);
    await mount();
    expect(container.textContent).toContain("Get a notification when your results, notices or messages arrive");
    const notNow = [...container.querySelectorAll("button")].find((b) => b.textContent === "Not now")!;
    await act(async () => notNow.click());
    expect(pushChoiceFor("a-ebere")).toBe("not-now");
    expect(container.textContent).not.toContain("Get a notification when");
    await mount();
    expect(container.textContent).not.toContain("Get a notification when");
  });

  it("is not made to a pupil who already chose, or offline, or after the phone said no", async () => {
    await mount();
    expect(container.textContent).not.toContain("Get a notification when");
    setPushChoice("a-ebere", null);
    mocks.offline = true;
    await mount();
    expect(container.textContent).not.toContain("Get a notification when");
    mocks.offline = false;
    mocks.permission = "denied";
    resetNativePushState();
    await mount();
    expect(container.textContent).not.toContain("Get a notification when");
  });

  it("turns notifications on from the offer once the pupil agrees", async () => {
    setPushChoice("a-ebere", null);
    await mount();
    const turnOnButton = [...container.querySelectorAll("button")].find((b) => b.textContent === "Turn on notifications")!;
    await act(async () => turnOnButton.click());
    await act(async () => undefined);
    expect(pushChoiceFor("a-ebere")).toBe("on");
    expect(container.textContent).not.toContain("Get a notification when");
  });
});
