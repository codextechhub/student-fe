/**
 * Deleting the account, for Ebere (who may ask her school to), Tunde (whose
 * request is already with the school), Bola (whose school offers nothing) and
 * a pupil whose account closes the moment she confirms.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: undefined as unknown,
  query: { isFetching: false, isError: false, error: undefined as unknown },
  refetch: vi.fn(),
  confirm: vi.fn(),
  navigate: vi.fn(),
  dispatch: vi.fn(),
  offline: false,
}));
vi.mock("react-router", async (original) => ({ ...(await original<typeof import("react-router")>()), useNavigate: () => mocks.navigate }));
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (pick: (s: unknown) => unknown) =>
    pick({ session: { active: "a-ebere", pupils: [] }, connectivity: { offline: mocks.offline } }),
}));
vi.mock("@/auth/device-session", () => ({ leaveAfterClosure: (account: string) => ({ type: "leave", account }) }));
vi.mock("@/redux/services/portal-api", () => ({
  refusal: (e: { data?: { message?: string } }) => ({ message: e?.data?.message ?? "Refused." }),
}));
vi.mock("@/redux/services/account-closure-api", () => ({
  closureOffered: (s: { eligible: boolean; pending: unknown } | undefined) => !!s && (s.eligible || !!s.pending),
  useClosureStateQuery: () => ({ data: mocks.state, refetch: mocks.refetch, ...mocks.query }),
  useConfirmClosureMutation: () => [mocks.confirm, { isLoading: false }],
}));

import { DeleteAccountCard } from "@/components/delete-account-card";

import { DeleteAccountPage } from "./delete-account";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.state = { eligible: true, mode: "request", pending: null };
  mocks.query = { isFetching: false, isError: false, error: undefined };
  mocks.offline = false;
  mocks.refetch.mockReset();
  mocks.navigate.mockReset();
  mocks.dispatch.mockReset().mockResolvedValue(undefined);
  mocks.confirm.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (node = <DeleteAccountPage />) => act(() => root.render(<MemoryRouter>{node}</MemoryRouter>));
const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
const answer = (value: unknown) => mocks.confirm.mockReturnValue({ unwrap: async () => value });

describe("the confirmation screen", () => {
  it("says what happens before offering the one button", () => {
    render();
    expect(container.textContent).toContain(
      "Your school will be asked to delete your sign-in. Your school record, results and fees stay with the school.",
    );
    expect(button("Send my request to the school")).toBeDefined();
    expect(container.textContent).not.toContain("request is with the school since");
  });

  it("sends the request, then says it went and offers no second one", async () => {
    answer({ status: "requested", requested_at: "2026-10-24T09:00:00Z" });
    render();
    await act(async () => button("Send my request to the school")!.click());
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.refetch).toHaveBeenCalled();
    expect(container.textContent).toContain("Your request has been sent to your school.");
    expect(button("Send my request to the school")).toBeUndefined();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("shows the date of a request already with the school, instead of the button", () => {
    mocks.state = { eligible: true, mode: "request", pending: { requested_at: "2026-10-20T10:30:00" } };
    render();
    expect(container.textContent).toContain("Your request is with the school since 20 Oct 2026.");
    expect(button("Send my request")).toBeUndefined();
  });

  it("shows the school's refusal word for word and keeps the button", async () => {
    mocks.confirm.mockReturnValue({ unwrap: async () => { throw { data: { message: "Try again later." } }; } });
    render();
    await act(async () => button("Send my request to the school")!.click());
    expect(container.querySelector("[role=alert]")?.textContent).toBe("Try again later.");
    expect(button("Send my request to the school")).toBeDefined();
  });

  it("takes the pupil off this phone and back to the pupil list or sign-in when the account closed at once", async () => {
    mocks.state = { eligible: true, mode: "close", pending: null };
    answer({ status: "closed" });
    render();
    expect(container.textContent).toContain("Your account will be deleted now");
    await act(async () => button("Delete my account now")!.click());
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: "leave", account: "a-ebere" });
    expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("offers no button when the school does not offer deletion for this account", () => {
    mocks.state = { eligible: false, mode: null, pending: null };
    render();
    expect(container.textContent).toContain("isn't available here for this account");
    expect(button("Send my request")).toBeUndefined();
  });

  it("offers no button when the API answers that deletion is not offered", () => {
    mocks.state = undefined;
    mocks.query = { isFetching: false, isError: true, error: { status: 403 } };
    render();
    expect(container.textContent).toContain("isn't available here for this account");
    expect(button("Send my request")).toBeUndefined();
  });

  it("says it cannot check, and offers a retry, when the school cannot be reached", () => {
    mocks.state = undefined;
    mocks.query = { isFetching: false, isError: true, error: { status: "FETCH_ERROR" } };
    render();
    expect(container.textContent).toContain("can't be checked right now");
    act(() => button("Try again")!.click());
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("shows it is asking again, not a blank screen, while a retry is on its way", () => {
    mocks.state = undefined;
    mocks.query = { isFetching: true, isError: false, error: undefined };
    render();
    expect(container.querySelector('[aria-label="Loading"]')).not.toBeNull();
    expect(container.textContent).not.toContain("can't be checked right now");
  });

  it("holds the button while offline", () => {
    mocks.offline = true;
    render();
    expect((button("Send my request to the school") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the entry on Profile", () => {
  it("links to the confirmation screen for a pupil who may delete", () => {
    render(<DeleteAccountCard />);
    const link = container.querySelector("a")!;
    expect(link.textContent).toBe("Delete my account");
    expect(link.getAttribute("href")).toBe("/profile/delete-account");
  });

  it("states the date of a waiting request in place of the link", () => {
    mocks.state = { eligible: true, mode: "request", pending: { requested_at: "2026-10-20T10:30:00" } };
    render(<DeleteAccountCard />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Your request is with the school since 20 Oct 2026.");
  });

  it("is absent when deletion is not offered, and while the answer has not come", () => {
    mocks.state = { eligible: false, mode: null, pending: null };
    render(<DeleteAccountCard />);
    expect(container.textContent).toBe("");
    mocks.state = undefined;
    render(<DeleteAccountCard />);
    expect(container.textContent).toBe("");
  });
});
