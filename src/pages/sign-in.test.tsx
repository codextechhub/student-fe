import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { status: "signed-out", notice: "", pupils: [] as { account: string; firstName: string; fullName: string; photo: string }[], active: "" },
}));
vi.mock("@/redux/hooks", () => ({ useAppDispatch: () => vi.fn(), useAppSelector: (selector: (state: unknown) => unknown) => selector({ session: mocks.session }) }));
vi.mock("@/redux/services/school-api", () => ({ useSchoolNameQuery: () => ({ data: "Lagoon View Academy" }) }));
vi.mock("@/utils/school-host", () => ({ currentSchoolSlug: () => "lagoon-view" }));
vi.mock("@/utils/school-brand", () => ({ schoolLogoUrl: () => "" }));
vi.mock("@/components/school-mark", () => ({ SchoolMark: () => <span>School crest</span> }));
vi.mock("@/components/pupil-avatar", () => ({ PupilAvatar: () => <span>EB</span> }));
vi.mock("@/auth/device-session", () => ({ signInPupil: vi.fn() }));

import { SignInPage } from "./sign-in";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.session = { status: "signed-out", notice: "", pupils: [], active: "" };
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(path = "/sign-in") {
  act(() => root.render(<MemoryRouter initialEntries={[path]}><SignInPage /></MemoryRouter>));
}

describe("student sign-in redesign", () => {
  it("shows the school name exactly once without a student-app label", () => {
    render();
    expect(container.querySelector(".signin-school-name")?.textContent).toBe("Lagoon View Academy");
    expect(container.textContent?.match(/Lagoon View Academy/g)).toHaveLength(1);
    expect(container.textContent).not.toContain("Student app");
  });

  it("keeps the form concise and lets the pupil reveal then hide the password", () => {
    render();
    expect(container.textContent).not.toContain("Use your admission number or your email to continue.");
    const input = container.querySelector('input[name="password"]') as HTMLInputElement;
    const toggle = container.querySelector('button[aria-label="Show password"]') as HTMLButtonElement;
    expect(input.type).toBe("password");
    act(() => toggle.click());
    expect(input.type).toBe("text");
    expect(container.querySelector('button[aria-label="Hide password"]')).not.toBeNull();
    act(() => (container.querySelector('button[aria-label="Hide password"]') as HTMLButtonElement).click());
    expect(input.type).toBe("password");
  });

  it("names the pupil who stays signed in while adding another", () => {
    mocks.session = { status: "signed-in", notice: "", pupils: [{ account: "ebere", firstName: "Ebere", fullName: "Ebere Bello", photo: "" }], active: "ebere" };
    render("/sign-in?add=1");
    expect(container.textContent).toContain("Add another pupil");
    expect(container.textContent).toContain("Ebere stays signed in");
    expect(container.querySelector('a[href="/"]')?.textContent).toContain("Cancel and return to Ebere");
  });
});
