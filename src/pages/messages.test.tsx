/**
 * The Messages screens, drawn from canned reads.
 *
 * Tunde writes to his Mathematics teacher. The list says in plain words that
 * his parent and the school can read it; the thread puts the school's reason
 * where the box would be when he can't write; and a send that does not get
 * through is retried with the same token, so it can never be stored twice.
 */
import { configureStore } from "@reduxjs/toolkit";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectivityReducer, wentOffline } from "@/redux/features/connectivity-slice";

const mocks = vi.hoisted(() => ({
  conversations: {} as Record<string, unknown>,
  row: {} as Record<string, unknown>,
  page: {} as Record<string, unknown>,
  contacts: {} as Record<string, unknown>,
  send: vi.fn(),
  start: vi.fn(),
  markRead: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn(), info: vi.fn() } }));

vi.mock("@/redux/services/messages-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/redux/services/messages-api")>()),
  useConversationsQuery: () => ({ data: mocks.conversations, isLoading: false, isError: false }),
  useConversationQuery: () => ({ data: mocks.row, isError: false }),
  useMessagesPageQuery: () => ({ data: mocks.page, isLoading: false, isError: false, refetch: vi.fn() }),
  useLazyMessagesPageQuery: () => [vi.fn(), { isFetching: false }],
  useContactsQuery: () => ({ data: mocks.contacts, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendMessageMutation: () => [mocks.send, { isLoading: false }],
  useStartConversationMutation: () => [mocks.start, { isLoading: false }],
  useMarkConversationReadMutation: () => [mocks.markRead],
}));

import { MessagesPage } from "./messages";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof makeStore>;

const makeStore = () => configureStore({ reducer: { connectivity: connectivityReducer } });
const NOTICE = "Your parent or guardian and the school can read your messages.";
const sentAt = new Date(2026, 9, 20, 9, 5).toISOString();

const row = (over: Record<string, unknown> = {}) => ({
  id: 41, kind: "PUPIL", kind_label: "Pupil", display_name: "Mrs Funke Okoro",
  counterpart: { user_id: 9, name: "Mrs Funke Okoro", label: "Mathematics" },
  last_message: { id: 903, preview: "Please bring your workbook", sender_name: "Mrs Funke Okoro", sent_at: sentAt, mine: false },
  last_activity_at: sentAt, unread_count: 2, read_only: false, can_send: true, read_only_reason: "", ...over,
});

beforeEach(() => {
  store = makeStore();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  window.scrollTo = vi.fn();
  mocks.conversations = { rows: [row()], unreadCount: 2, oversightNotice: NOTICE, next: null };
  mocks.row = row();
  mocks.page = {
    results: [
      { id: 903, body: "Please bring your workbook", sender: { user_id: 9, name: "Mrs Funke Okoro" }, sent_at: sentAt, mine: false },
      { id: 902, body: "Good morning, Mrs Okoro", sender: { user_id: 1, name: "Tunde" }, sent_at: sentAt, mine: true },
    ],
    hasMore: false, nextBefore: null,
  };
  mocks.contacts = {
    contacts: [{ user_id: 9, name: "Mrs Funke Okoro", label: "Mathematics" }, { user_id: 4, name: "Mr Ade Bello", label: "Class teacher, JSS1 A" }],
    canStart: true, canStartReason: "", oversightNotice: NOTICE,
  };
  mocks.send.mockReset();
  mocks.start.mockReset();
  mocks.markRead.mockReset();
  mocks.markRead.mockReturnValue(Promise.resolve());
  mocks.toastError.mockReset();
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; });

function render(at: string) {
  act(() => root.render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/new" element={<MessagesPage />} />
          <Route path="/messages/:id" element={<MessagesPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  ));
}

/** Types into a React-controlled textarea the way a keyboard does. */
function type(field: HTMLTextAreaElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => { set.call(field, text); field.dispatchEvent(new Event("input", { bubbles: true })); });
}

const sendButton = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Send")) as HTMLButtonElement;

describe("the conversation list", () => {
  it("says plainly that a parent and the school can read, and shows who, what and how many unread", () => {
    render("/messages");
    expect(container.querySelector(".messages-oversight")?.textContent).toBe(NOTICE);
    const text = container.querySelector(".messages-row")!.textContent!;
    expect(text).toContain("Mrs Funke Okoro");
    expect(text).toContain("Mathematics");
    expect(text).toContain("Please bring your workbook");
    expect(container.querySelector(".messages-badge")?.textContent).toBe("2");
    expect(container.textContent).toContain("2 unread");
    expect(container.querySelector('a[href="/messages/41"]')).not.toBeNull();
    expect(container.querySelector('a[href="/messages/new"]')).not.toBeNull();
  });

  it("invites a first message when there are no conversations, notice still showing", () => {
    mocks.conversations = { rows: [], unreadCount: 0, oversightNotice: NOTICE, next: null };
    render("/messages");
    expect(container.textContent).toContain("No messages yet");
    expect(container.querySelector(".messages-oversight")?.textContent).toBe(NOTICE);
  });
});

describe("a thread", () => {
  it("reads oldest to newest, marks the unread conversation read, and offers the box", () => {
    render("/messages/41");
    const bubbles = [...container.querySelectorAll(".messages-bubble p")].map((p) => p.textContent);
    expect(bubbles).toEqual(["Good morning, Mrs Okoro", "Please bring your workbook"]);
    expect(container.querySelector(".messages-bubble.is-mine")?.textContent).toContain("Good morning");
    expect(mocks.markRead).toHaveBeenCalledWith({ id: 41 });
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("does not mark an already read conversation read again", () => {
    mocks.row = row({ unread_count: 0 });
    render("/messages/41");
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("shows the school's reason in place of the box when the pupil can't write", () => {
    mocks.row = row({ can_send: false, read_only: true, read_only_reason: "No longer at the school." });
    render("/messages/41");
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector(".messages-readonly")?.textContent).toBe("No longer at the school.");
  });

  it("offers earlier messages only when the school has more", () => {
    render("/messages/41");
    expect(container.querySelector(".messages-earlier")).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    mocks.page = { ...mocks.page, hasMore: true, nextBefore: 902 };
    render("/messages/41");
    expect(container.querySelector(".messages-earlier")?.textContent).toContain("Earlier messages");
  });

  it("keeps the box shut while offline and says why", () => {
    act(() => { store.dispatch(wentOffline()); });
    render("/messages/41");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).disabled).toBe(true);
    expect(container.querySelector(".messages-box-bar p")?.textContent).toContain("Sending waits until you have a connection");
    expect(sendButton().disabled).toBe(true);
  });
});

describe("sending in a thread", () => {
  it("retries the same words with the same token, and new words with a new one", async () => {
    mocks.send.mockReturnValueOnce({ unwrap: () => Promise.reject({ status: "FETCH_ERROR" }) });
    mocks.send.mockReturnValueOnce({ unwrap: () => Promise.resolve({}) });
    mocks.send.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    render("/messages/41");
    const box = container.querySelector("textarea") as HTMLTextAreaElement;

    type(box, "  I will, thank you  ");
    await act(async () => { sendButton().click(); });
    expect(box.value).toBe("  I will, thank you  ");
    await act(async () => { sendButton().click(); });
    expect(box.value).toBe("");

    const [first, retry] = mocks.send.mock.calls.map((c) => c[0] as { id: number; body: string; clientToken: string });
    expect(first).toMatchObject({ id: 41, body: "I will, thank you" });
    expect(retry.clientToken).toBe(first.clientToken);

    type(box, "Another thing");
    await act(async () => { sendButton().click(); });
    const third = mocks.send.mock.calls[2][0] as { clientToken: string };
    expect(third.clientToken).not.toBe(first.clientToken);
  });

  it("says the send limit in the school's words, keeps the words and token, and sends them on the next tap", async () => {
    const sentence = "You are sending messages too quickly. Wait a moment and try again.";
    mocks.send.mockReturnValueOnce({
      unwrap: () => Promise.reject({
        status: 429,
        data: { success: false, message: sentence, error: { code: "MESSAGE_RATE_LIMITED", detail: { retry_after: 12 } } },
      }),
    });
    mocks.send.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    render("/messages/41");
    const box = container.querySelector("textarea") as HTMLTextAreaElement;

    type(box, "On my way");
    await act(async () => { sendButton().click(); });
    expect(mocks.toastError).toHaveBeenCalledWith(sentence);
    expect(box.value).toBe("On my way");
    expect(sendButton().disabled).toBe(false);

    await act(async () => { sendButton().click(); });
    const [first, again] = mocks.send.mock.calls.map((c) => c[0] as { clientToken: string });
    expect(again.clientToken).toBe(first.clientToken);
    expect(box.value).toBe("");
  });

  it("sends once however many times Send is tapped while it is going", async () => {
    let release: () => void = () => {};
    mocks.send.mockReturnValue({ unwrap: () => new Promise<object>((resolve) => { release = () => resolve({}); }) });
    render("/messages/41");
    type(container.querySelector("textarea") as HTMLTextAreaElement, "On my way");
    await act(async () => { sendButton().click(); sendButton().click(); sendButton().click(); });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
  });

  it("will not send a message over the limit, and says by how much", () => {
    render("/messages/41");
    type(container.querySelector("textarea") as HTMLTextAreaElement, "x".repeat(4003));
    expect(sendButton().disabled).toBe(true);
    expect(container.querySelector(".messages-box-bar p")?.textContent).toContain("3 too many characters");
  });
});

describe("a new message", () => {
  it("shows the notice and the teachers, and holds Send until one is chosen and something is written", () => {
    render("/messages/new");
    const sheet = document.querySelector(".messages-sheet")!;
    expect(sheet.querySelector(".messages-oversight")?.textContent).toBe(NOTICE);
    const names = [...sheet.querySelectorAll(".messages-contact-text strong")].map((n) => n.textContent);
    expect(names).toEqual(["Mrs Funke Okoro", "Mr Ade Bello"]);
    expect(sheet.textContent).toContain("Class teacher, JSS1 A");
    const send = [...sheet.querySelectorAll("button")].find((b) => b.textContent?.includes("Send message")) as HTMLButtonElement;
    type(sheet.querySelector("textarea") as HTMLTextAreaElement, "Hello sir");
    expect(send.disabled).toBe(true);
    act(() => (sheet.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement).click());
    expect(send.disabled).toBe(false);
  });

  it("starts the conversation with the chosen teacher and opens it", async () => {
    mocks.start.mockReturnValue({ unwrap: () => Promise.resolve({ conversation: row({ id: 77 }), message: null }) });
    render("/messages/new");
    const sheet = document.querySelector(".messages-sheet")!;
    act(() => (sheet.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement).click());
    type(sheet.querySelector("textarea") as HTMLTextAreaElement, "Hello sir");
    await act(async () => { ([...sheet.querySelectorAll("button")].find((b) => b.textContent?.includes("Send message")) as HTMLButtonElement).click(); });
    expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ staff: 4, body: "Hello sir" }));
    expect(document.querySelector(".messages-sheet")).toBeNull();
  });

  it("gives the school's reason, and no way to write, when new messages are switched off", () => {
    mocks.contacts = { contacts: [], canStart: false, canStartReason: "Messaging with pupils is switched off at this school.", oversightNotice: NOTICE };
    render("/messages/new");
    const sheet = document.querySelector(".messages-sheet")!;
    expect(sheet.textContent).toContain("Messaging with pupils is switched off at this school.");
    expect(sheet.querySelector("textarea")).toBeNull();
  });
});
