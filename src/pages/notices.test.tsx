/**
 * A notice on its own screen: shown whole, and marked read as it opens,
 * once, and never while offline.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  offline: false,
  notice: undefined as Record<string, unknown> | undefined,
  isError: false,
  markRead: vi.fn(),
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({ connectivity: { offline: mocks.offline } }),
}));
vi.mock("@/redux/services/portal-api", () => ({
  useNoticeQuery: () => ({ data: mocks.notice, isError: mocks.isError }),
  useMarkNoticeReadMutation: () => [mocks.markRead],
}));

import { NoticesPage } from "./notices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

const notice = (over: Record<string, unknown> = {}) => ({
  id: 12, title: "Inter-house sports on Friday", body: "Wear your house colours.", audience_label: "All pupils",
  published_at: "2026-10-24T09:00:00Z", edited_at: null, unread: true, ...over,
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.offline = false;
  mocks.isError = false;
  mocks.notice = notice();
  mocks.markRead.mockReset();
  mocks.markRead.mockReturnValue({ unwrap: () => Promise.resolve() });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(at = "/notices/12") {
  act(() => root.render(
    <MemoryRouter initialEntries={[at]}>
      <Routes><Route path="/notices/:id" element={<NoticesPage />} /></Routes>
    </MemoryRouter>,
  ));
}

describe("a notice", () => {
  it("shows the notice whole, with a way back to the inbox", () => {
    render();
    const card = container.querySelector(".notice-card")!;
    expect(card.querySelector("h2")?.textContent).toBe("Inter-house sports on Friday");
    expect(card.textContent).toContain("All pupils");
    expect(card.textContent).toContain("Wear your house colours.");
    expect(container.querySelector('.detail-bar a[href="/inbox"]')).not.toBeNull();
  });

  it("marks an unread notice read as it opens, once", () => {
    render();
    render();
    expect(mocks.markRead).toHaveBeenCalledTimes(1);
    expect(mocks.markRead).toHaveBeenCalledWith(12);
  });

  it("does not mark a read notice again, or any notice offline", () => {
    mocks.notice = notice({ unread: false });
    render();
    expect(mocks.markRead).not.toHaveBeenCalled();
    act(() => root.unmount());
    root = createRoot(container);
    mocks.notice = notice();
    mocks.offline = true;
    render();
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("says when a notice was edited", () => {
    mocks.notice = notice({ edited_at: "2026-10-25T09:00:00Z" });
    render();
    expect(container.querySelector(".notice-edited")?.textContent).toBe("EditedChanged on 25 Oct 2026");
  });

  it("says so when the notice is gone", () => {
    mocks.isError = true;
    render();
    expect(container.textContent).toContain("This notice isn't available any more.");
  });
});
