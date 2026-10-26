/**
 * The frame around an open conversation.
 *
 * On the list the header and the floating tab bar are there as always. Opening
 * a conversation holds the shell to the visible height and marks both to step
 * aside on a phone, so the conversation's own header is the top of the screen.
 * The 800px breakpoint is in `app-shell.css`, which happy-dom does not apply, so
 * these tests hold the mark the stylesheet reads. That the mark hides only below
 * 800px is checked in a real browser, not here.
 */
import { configureStore } from "@reduxjs/toolkit";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { sessionReducer, sessionSettled } from "@/redux/features/session-slice";

vi.mock("@/auth/device-session", () => ({ refreshShowingPupil: () => ({ type: "test/refresh" }) }));
vi.mock("@/components/session/pupil-switcher", () => ({ PupilSwitcher: () => <button type="button">Switch pupil</button> }));
vi.mock("@/components/pupil-avatar", () => ({ PupilAvatar: () => null }));
vi.mock("@/components/school-mark", () => ({ SchoolMark: () => null }));
vi.mock("@/redux/services/portal-api", () => ({
  useMeQuery: () => ({ data: undefined }),
  useNoticesQuery: () => ({ data: { unreadCount: 3 } }),
}));
vi.mock("@/redux/services/messages-api", () => ({ useUnreadMessagesQuery: () => ({ data: 1 }) }));

import { AppShell } from "./app-shell";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

function render(at: string) {
  const store = configureStore({ reducer: { connectivity: connectivityReducer, session: sessionReducer } });
  store.dispatch(sessionSettled({ status: "signed-in", pupils: [{ account: "a1", studentId: 1, fullName: "Tolulope Adeyemi", firstName: "Tolulope", photo: "" }], active: "a1" }));
  act(() => root.render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>home</p>} />
            <Route path="notices" element={<p>notices</p>} />
            <Route path="inbox" element={<p>inbox</p>} />
            <Route path="profile" element={<p>profile</p>} />
            <Route path="messages" element={<p>list</p>} />
            <Route path="messages/:id" element={<p>thread</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  ));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("the app shell", () => {
  it("keeps the tab bar on the list of messages", () => {
    render("/messages");
    expect(container.querySelector("nav")?.hasAttribute("data-hidden-on-phone")).toBe(false);
    expect(container.querySelector("header")?.hasAttribute("data-hidden-on-phone")).toBe(false);
    expect(container.querySelector(".app-shell")?.classList.contains("app-shell--conversation")).toBe(false);
  });

  it("holds an open conversation to the screen and marks the tab bar to step aside on a phone", () => {
    render("/messages/41");
    expect(container.querySelector("nav")?.getAttribute("data-hidden-on-phone")).toBe("true");
    expect(container.querySelector("header")?.getAttribute("data-hidden-on-phone")).toBe("true");
    expect(container.querySelector(".app-shell")?.classList.contains("app-shell--conversation")).toBe(true);
  });

  it("holds four tabs and an Inbox button carrying unread notices and messages", () => {
    render("/");
    const tabs = [...container.querySelectorAll(".tab-bar a")].map((a) => a.textContent);
    expect(tabs).toEqual(["Home", "Timetable", "Results", "Fees"]);
    const inbox = container.querySelector(".tab-bar-inbox");
    expect(inbox?.getAttribute("aria-label")).toBe("Inbox, 4 unread");
    expect(inbox?.hasAttribute("data-showing")).toBe(false);
  });

  it("opens the Inbox from the Inbox button", () => {
    render("/");
    expect(container.querySelector(".tab-bar-inbox")?.getAttribute("href")).toBe("/inbox");
  });

  it("marks the Inbox button on the Inbox and on a notice or conversation opened from it", () => {
    render("/notices");
    expect(container.querySelector(".tab-bar-inbox")?.hasAttribute("data-showing")).toBe(true);
  });

  it("keeps the Inbox's name out of the header while its large title shows", () => {
    render("/inbox");
    expect(container.querySelector(".app-shell-title")?.hasAttribute("data-hidden")).toBe(true);
    expect(container.querySelector(".tab-bar-inbox")?.hasAttribute("data-showing")).toBe(true);
  });

  it("leads to Profile from the avatar", () => {
    render("/");
    expect(container.querySelector("header a[href='/profile']")).not.toBeNull();
  });

  it("offers the pupil switcher in the avatar's place on Profile", () => {
    render("/profile");
    expect(container.querySelector("header a[href='/profile']")).toBeNull();
    expect(container.querySelector("header button")?.textContent).toBe("Switch pupil");
  });
});
