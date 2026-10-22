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

vi.mock("@/auth/device-session", () => ({ refreshShowingPupil: () => ({ type: "test/refresh" }) }));
vi.mock("@/components/session/pupil-switcher", () => ({ PupilSwitcher: () => null }));
vi.mock("@/components/school-mark", () => ({ SchoolMark: () => null }));
vi.mock("@/redux/services/portal-api", () => ({
  useMeQuery: () => ({ data: undefined }),
  useNoticesQuery: () => ({ data: undefined }),
}));
vi.mock("@/redux/services/messages-api", () => ({ useUnreadMessagesQuery: () => ({ data: 0 }) }));

import { AppShell } from "./app-shell";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

function render(at: string) {
  const store = configureStore({ reducer: { connectivity: connectivityReducer } });
  act(() => root.render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route element={<AppShell />}>
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
});
