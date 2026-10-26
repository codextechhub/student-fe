/**
 * The frame around the screens: the header and the split tab bar, which step
 * aside for an open conversation (held to the visible height) and for a
 * screen opened from another, at every size.
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
  it("keeps the header and the tab bar on the Inbox", () => {
    render("/inbox");
    expect(container.querySelector("nav")).not.toBeNull();
    expect(container.querySelector("header")?.hasAttribute("data-hidden")).toBe(false);
    expect(container.querySelector(".app-shell")?.classList.contains("app-shell--conversation")).toBe(false);
  });

  it("holds an open conversation to the screen, the header and tab bar stepping aside at every size", () => {
    render("/messages/41");
    expect(container.querySelector("nav")).toBeNull();
    expect(container.querySelector("header")?.getAttribute("data-hidden")).toBe("true");
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

  it("puts the tinted pill under the tab showing, and fades it where no tab is showing", () => {
    render("/");
    const pill = container.querySelector<HTMLElement>(".tab-bar-pill")!;
    expect(pill.style.transform).toBe("translateX(calc(0% + 0px))");
    expect(pill.hasAttribute("data-hidden")).toBe(false);
  });

  it("fades the pill on a screen that is no tab", () => {
    render("/inbox");
    expect(container.querySelector(".tab-bar-pill")?.hasAttribute("data-hidden")).toBe(true);
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
