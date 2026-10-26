/**
 * The Notifications row on Profile: a switch where the pupil can choose, and
 * the state in words, with what to do, where they can't.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: "off" as string,
  offline: false,
  turnOn: vi.fn(),
  turnOff: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/native/platform", () => ({ isNativeApp: () => false }));
vi.mock("@/native/native-push-setting", () => ({ NativePushSetting: () => null }));
vi.mock("@/push/use-push", () => ({
  usePush: () => ({ state: mocks.state, busy: false, turnOn: mocks.turnOn, turnOff: mocks.turnOff }),
}));
vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({
    connectivity: { offline: mocks.offline },
    session: { active: "a1", pupils: [{ account: "a1", firstName: "Ebere" }] },
  }),
}));

import { PushSetting } from "./push-settings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.state = "off";
  mocks.offline = false;
  mocks.turnOn.mockReset();
  mocks.turnOn.mockResolvedValue({ ok: true });
  mocks.turnOff.mockReset();
  mocks.turnOff.mockResolvedValue(true);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = () => act(() => root.render(<PushSetting />));
const toggle = () => container.querySelector<HTMLButtonElement>('[role="switch"]');

describe("the Notifications row", () => {
  it("offers a switch that is off, and turns notifications on with it", async () => {
    render();
    expect(toggle()?.getAttribute("aria-checked")).toBe("false");
    expect(toggle()?.getAttribute("aria-label")).toBe("Notifications for Ebere on this device");
    await act(async () => toggle()!.click());
    expect(mocks.turnOn).toHaveBeenCalledTimes(1);
  });

  it("shows the switch on, and turns notifications off with it", async () => {
    mocks.state = "on";
    render();
    expect(toggle()?.getAttribute("aria-checked")).toBe("true");
    await act(async () => toggle()!.click());
    expect(mocks.turnOff).toHaveBeenCalledTimes(1);
  });

  it("holds the switch while offline", () => {
    mocks.offline = true;
    render();
    expect(toggle()?.disabled).toBe(true);
  });

  it("says Blocked, with where to allow them, in place of a switch", () => {
    mocks.state = "blocked";
    render();
    expect(toggle()).toBeNull();
    expect(container.querySelector(".settings-value")?.textContent).toBe("Blocked");
    expect(container.textContent).toContain("Allow them in browser settings");
  });

  it("says to add the app first on an iPhone", () => {
    mocks.state = "install-first";
    render();
    expect(container.querySelector(".settings-value")?.textContent).toBe("Add the app first");
  });
});
