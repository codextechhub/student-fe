/**
 * The Inbox: notices and conversations in one list, newest first, with the
 * All, Notices and Messages switch, and notices read as they are opened.
 */
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  offline: false,
  notices: [] as unknown[],
  noticesUnread: 0,
  conversations: [] as unknown[],
  messagesUnread: 0,
  markRead: vi.fn(),
  markAll: vi.fn(),
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({ connectivity: { offline: mocks.offline } }),
}));
vi.mock("@/redux/services/portal-api", () => ({
  useNoticesQuery: () => ({ data: { notices: mocks.notices, unreadCount: mocks.noticesUnread, next: null }, isLoading: false, isError: false, refetch: vi.fn() }),
  useMarkNoticeReadMutation: () => [mocks.markRead],
  useMarkAllNoticesReadMutation: () => [mocks.markAll, { isLoading: false }],
  refusal: () => ({ message: "" }),
}));
vi.mock("@/redux/services/messages-api", () => ({
  OVERSIGHT_FALLBACK: "Your parent or guardian and the school can read your messages.",
  useConversationsQuery: () => ({
    data: { rows: mocks.conversations, unreadCount: mocks.messagesUnread, oversightNotice: "Your parent or guardian and the school can read your messages.", next: null },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useUnreadMessagesQuery: () => ({ data: mocks.messagesUnread }),
}));
vi.mock("./messages-new", () => ({ NewMessageSheet: ({ open }: { open: boolean }) => (open ? <div className="sheet-open" /> : null) }));

import { InboxPage } from "./inbox";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const notice = (id: number, at: string, unread = false) => ({
  id, title: `Notice ${id}`, body: "Wear your house colours.", audience_label: "All pupils", published_at: at, edited_at: null, unread,
});
const conversation = (id: number, at: string, unread = 0) => ({
  id, kind: "DIRECT", kind_label: "", display_name: "Mr. Okafor", counterpart: { user_id: 3, name: "Mr. Okafor", label: "Mathematics teacher" },
  last_message: { id, preview: "Well done on the test.", sender_name: "Mr. Okafor", sent_at: at, mine: false },
  last_activity_at: at, unread_count: unread, read_only: false, can_send: true, read_only_reason: "",
});

let container: HTMLDivElement;
let root: Root;
let where = "";
function Where() {
  const location = useLocation();
  useEffect(() => { where = location.pathname + location.search; });
  return null;
}
function render(at: string) {
  act(() => root.render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      <Routes>
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/inbox/new" element={<InboxPage />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  ));
}
const rows = () => [...container.querySelectorAll(".inbox-row")].map((row) => row.getAttribute("aria-label"));
const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith(text)) as HTMLButtonElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.offline = false;
  mocks.notices = [notice(1, "2026-10-24T09:00:00Z", true), notice(4, "2026-10-14T09:00:00Z")];
  mocks.noticesUnread = 1;
  mocks.conversations = [conversation(41, "2026-10-26T09:12:00Z", 1)];
  mocks.messagesUnread = 1;
  mocks.markRead.mockReset();
  mocks.markRead.mockReturnValue({ unwrap: () => Promise.resolve() });
  mocks.markAll.mockReset();
  mocks.markAll.mockReturnValue({ unwrap: () => Promise.resolve() });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("the Inbox", () => {
  it("lists notices and conversations together, newest first, with every unread count", () => {
    render("/inbox");
    expect(rows()).toEqual(["Conversation with Mr. Okafor, 1 unread", "Notice: Notice 1, unread", "Notice: Notice 4"]);
    expect(container.querySelector(".screen-title-eyebrow")?.textContent).toBe("2 unread");
    expect([...container.querySelectorAll(".inbox-filters button")].map((b) => b.textContent)).toEqual(["All · 2", "Notices · 1", "Messages · 1"]);
    expect(container.querySelector(".inbox-oversight")?.textContent).toContain("can read your messages");
  });

  it("shows one list at a time, kept in the address", () => {
    render("/inbox");
    act(() => button("Notices").click());
    expect(where).toBe("/inbox?show=notices");
    expect(rows()).toEqual(["Notice: Notice 1, unread", "Notice: Notice 4"]);
    expect(container.querySelector(".inbox-oversight")).toBeNull();
    act(() => button("Messages").click());
    expect(rows()).toEqual(["Conversation with Mr. Okafor, 1 unread"]);
  });

  it("marks an unread notice read as it opens, and opens it", () => {
    render("/inbox");
    act(() => (container.querySelector('a[href="/notices/1"]') as HTMLAnchorElement).click());
    expect(mocks.markRead).toHaveBeenCalledWith(1);
    expect(where).toBe("/notices/1");
  });

  it("leaves a notice unread when it is opened offline", () => {
    mocks.offline = true;
    render("/inbox");
    act(() => (container.querySelector('a[href="/notices/1"]') as HTMLAnchorElement).click());
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("opens a conversation without marking it read from the list", () => {
    render("/inbox");
    act(() => (container.querySelector('a[href="/messages/41"]') as HTMLAnchorElement).click());
    expect(mocks.markRead).not.toHaveBeenCalled();
    expect(where).toBe("/messages/41");
  });

  it("marks notices read in one go", async () => {
    render("/inbox");
    await act(async () => button("Mark all notices read").click());
    expect(mocks.markAll).toHaveBeenCalledTimes(1);
  });

  it("offers no way to mark messages read without opening them", () => {
    render("/inbox?show=messages");
    expect(button("Mark all")).toBeUndefined();
  });

  it("says when there is nothing in a list", () => {
    mocks.notices = [];
    mocks.noticesUnread = 0;
    render("/inbox?show=notices");
    expect(container.querySelector(".inbox-empty h2")?.textContent).toBe("No notices yet");
  });

  it("keeps the list's filter when the new message sheet opens over it", () => {
    render("/inbox?show=messages");
    expect(container.querySelector('a[href="/inbox/new?show=messages"]')).not.toBeNull();
  });

  it("opens the new message sheet over the list", () => {
    render("/inbox/new");
    expect(container.querySelector(".sheet-open")).not.toBeNull();
    expect(rows().length).toBe(3);
  });
});
