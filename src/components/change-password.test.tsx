/**
 * Ebere Bello at Lagoon View changes the password she told a classmate, from
 * My profile on her mother's phone.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  offline: false,
  change: vi.fn(),
  dispatch: vi.fn(),
  navigate: vi.fn(),
  signOut: vi.fn((account: string) => ({ type: "signOutAfterPasswordChange", account })),
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) =>
    pick({ connectivity: { offline: mocks.offline }, session: { active: "a-ebere" } }),
  useAppDispatch: () => mocks.dispatch,
}));
vi.mock("react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/auth/device-session", () => ({ signOutAfterPasswordChange: mocks.signOut }));
vi.mock("@/redux/services/password-api", async (importActual) => ({
  ...(await importActual<typeof import("@/redux/services/password-api")>()),
  usePasswordPolicyQuery: () => ({
    data: { min_length: 12, requirements: ["At least 12 characters", "A number (0–9)"] },
  }),
  useChangePasswordMutation: () => [mocks.change, { isLoading: false }],
}));

import { ChangePassword, MISMATCH_MESSAGE, SIGNED_OUT_EVERYWHERE_MESSAGE } from "./change-password";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.offline = false;
  mocks.dispatch.mockReset();
  mocks.navigate.mockReset();
  mocks.signOut.mockClear();
  mocks.change.mockReset().mockReturnValue({ unwrap: async () => undefined });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (expand = true) => {
  act(() => root.render(<ChangePassword />));
  if (expand) act(() => button("Change password").click());
};
const box = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!;
const errorUnder = (id: string) => container.querySelector(`#${id}-error`)?.textContent ?? "";
const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label))!;
const type = (id: string, value: string) =>
  act(() => {
    const input = box(id);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const fill = (current: string, next: string, again = next) => {
  type("current_password", current);
  type("new_password", next);
  type("confirm_password", again);
};
const save = () => act(async () => button("Save password").click());
const refused = (error: Record<string, unknown>) =>
  mocks.change.mockReturnValue({
    unwrap: async () => {
      throw { status: 400, data: { success: false, message: "Invalid request.", error } };
    },
  });

describe("changing a pupil's password", () => {
  it("shows a Change password button before any password fields", () => {
    render(false);
    expect(button("Change password")).toBeDefined();
    expect(container.querySelector("#current_password")).toBeNull();
    expect(container.querySelector("#new_password")).toBeNull();
    expect(container.querySelector("#confirm_password")).toBeNull();
    act(() => button("Change password").click());
    expect(box("current_password")).not.toBeNull();
  });

  it("closes the form and clears typed passwords when cancelled", () => {
    render();
    type("current_password", "Ebere@Lagoon2026");
    act(() => button("Cancel").click());
    expect(container.querySelector("#current_password")).toBeNull();
    act(() => button("Change password").click());
    expect(box("current_password").value).toBe("");
  });

  it("sends exactly the current password and the new one twice", async () => {
    render();
    fill("Ebere@Lagoon2026", "Bello#Garden2027");
    await save();
    expect(mocks.change).toHaveBeenCalledWith({
      current_password: "Ebere@Lagoon2026",
      password: "Bello#Garden2027",
      confirm_password: "Bello#Garden2027",
    });
  });

  it("shows a wrong current password under Current password", async () => {
    refused({ current_password: ["Current password is incorrect."] });
    render();
    fill("Told-a-friend1!", "Bello#Garden2027");
    await save();
    expect(errorUnder("current_password")).toBe("Current password is incorrect.");
    expect(errorUnder("new_password")).toBe("");
    expect(container.querySelector("[role=alert]")).toBeNull();
  });

  it("shows the school's password rules refusal under New password", async () => {
    refused({
      password: ["This password is too common.", "This password must contain a special character."],
    });
    render();
    fill("Ebere@Lagoon2026", "password1234");
    await save();
    expect(errorUnder("new_password")).toBe(
      "This password is too common. This password must contain a special character.",
    );
  });

  it("catches a mismatch before sending anything", async () => {
    render();
    fill("Ebere@Lagoon2026", "Bello#Garden2027", "Bello#Garden2028");
    expect(errorUnder("confirm_password")).toBe(MISMATCH_MESSAGE);
    expect(button("Save password").disabled).toBe(true);
    await save();
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("keeps Save off until all three boxes are filled", () => {
    render();
    expect(button("Save password").disabled).toBe(true);
    type("new_password", "Bello#Garden2027");
    type("confirm_password", "Bello#Garden2027");
    expect(button("Save password").disabled).toBe(true);
    type("current_password", "Ebere@Lagoon2026");
    expect(button("Save password").disabled).toBe(false);
  });

  it("empties the boxes and says she is signed out everywhere, this phone included", async () => {
    render();
    fill("Ebere@Lagoon2026", "Bello#Garden2027");
    await save();
    expect(box("current_password").value).toBe("");
    expect(box("new_password").value).toBe("");
    expect(box("confirm_password").value).toBe("");
    const status = container.querySelector("[role=status]")?.textContent ?? "";
    expect(status).toContain("Password changed.");
    expect(status).toContain(SIGNED_OUT_EVERYWHERE_MESSAGE);
  });

  it("signs her out here through the session module, then opens the sign-in screen", async () => {
    render();
    fill("Ebere@Lagoon2026", "Bello#Garden2027");
    await save();
    await act(async () => button("Sign in again now").click());
    expect(mocks.signOut).toHaveBeenCalledWith("a-ebere");
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: "signOutAfterPasswordChange", account: "a-ebere" });
    // Never left on the profile page, where her brother Femi now shows.
    expect(mocks.navigate).toHaveBeenCalledWith("/sign-in?add=1", { replace: true });
    expect(mocks.dispatch.mock.invocationCallOrder[0]).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
  });

  it("lists the school's own rules beside the new password", () => {
    render();
    const rules = container.querySelector('[aria-label="Password rules"]')?.textContent ?? "";
    expect(rules).toContain("At least 12 characters");
    expect(rules).toContain("A number (0–9)");
  });

  it("changes nothing offline", () => {
    mocks.offline = true;
    render();
    fill("Ebere@Lagoon2026", "Bello#Garden2027");
    expect(button("Save password").disabled).toBe(true);
    expect(container.textContent).toContain("when you're back online");
  });
});
