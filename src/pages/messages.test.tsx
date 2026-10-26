/**
 * The Messages screens, drawn from canned reads.
 *
 * Tunde writes to his Mathematics teacher. The new-message sheet says in plain
 * words that his parent and the school can read it; the thread puts the school's reason
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
import { sessionReducer, sessionSettled } from "@/redux/features/session-slice";

const mocks = vi.hoisted(() => ({
  conversations: {} as Record<string, unknown>,
  row: {} as Record<string, unknown>,
  page: {} as Record<string, unknown>,
  contacts: {} as Record<string, unknown>,
  send: vi.fn(),
  fetchOlder: vi.fn(),
  poll: vi.fn(),
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
  useLazyMessagesPageQuery: () => [mocks.fetchOlder, { isFetching: false }],
  useLazyMessagesAfterQuery: () => [mocks.poll],
  useContactsQuery: () => ({ data: mocks.contacts, isLoading: false, isError: false, refetch: vi.fn() }),
  useSendMessageMutation: () => [mocks.send, { isLoading: false }],
  useStartConversationMutation: () => [mocks.start, { isLoading: false }],
  useMarkConversationReadMutation: () => [mocks.markRead],
}));

import { MessagesPage } from "./messages";
import { NewMessageSheet } from "./messages-new";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof makeStore>;

/** The scroll height every element reports; happy-dom lays nothing out, so the tests say how tall the thread is. */
let listHeight = 1000;
vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => listHeight);
vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => 400);

const makeStore = () => configureStore({ reducer: { connectivity: connectivityReducer, session: sessionReducer } });
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
  listHeight = 1000;
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
  mocks.fetchOlder.mockReset();
  mocks.poll.mockReset();
  mocks.poll.mockResolvedValue({ data: { results: [], hasMore: false, receipts: [] } });
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
          <Route path="/messages/new" element={<NewMessageSheet open />} />
          <Route path="/messages/:id" element={<MessagesPage />} />
          <Route path="*" element={<p>elsewhere</p>} />
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

describe("a thread", () => {
  it("reads oldest to newest, marks the unread conversation read, and offers the box", () => {
    render("/messages/41");
    const bubbles = [...container.querySelectorAll(".messages-bubble p")].map((p) => p.textContent);
    expect(bubbles).toEqual(["Good morning, Mrs Okoro", "Please bring your workbook"]);
    expect(container.querySelector(".messages-bubble.is-mine")?.textContent).toContain("Good morning");
    expect(mocks.markRead).toHaveBeenCalledWith({ id: 41, upTo: 903 });
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

describe("an open conversation as a fixed column", () => {
  const list = () => container.querySelector(".messages-scroll") as HTMLDivElement;
  const pill = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("New messages"));
  const scrollTo = (top: number) => act(() => { list().scrollTop = top; list().dispatchEvent(new Event("scroll")); });
  const arrive = (extra: Record<string, unknown>) => {
    const page = mocks.page as { results: unknown[] };
    mocks.page = { ...page, results: [extra, ...page.results] };
    listHeight += 120;
    render("/messages/41");
  };
  const incoming = { id: 904, body: "Also page 12", sender: { user_id: 9, name: "Mrs Funke Okoro" }, sent_at: sentAt, mine: false };

  it("keeps the name and the box outside the list that scrolls", () => {
    render("/messages/41");
    expect(list().contains(container.querySelector(".messages-bubble"))).toBe(true);
    expect(list().contains(container.querySelector(".messages-thread-head"))).toBe(false);
    expect(list().contains(container.querySelector("textarea"))).toBe(false);
    expect(container.querySelector(".messages-thread-head h2")?.textContent).toBe("Mrs Funke Okoro");
    expect(container.querySelector(".messages-page")?.classList.contains("has-conversation")).toBe(true);
  });

  it("keeps the school's reason outside the list too when the pupil can't write", () => {
    mocks.row = row({ can_send: false, read_only: true, read_only_reason: "No longer at the school." });
    render("/messages/41");
    expect(list().contains(container.querySelector(".messages-readonly"))).toBe(false);
  });

  it("opens on the newest message", () => {
    render("/messages/41");
    expect(list().scrollTop).toBe(1000);
    expect(pill()).toBeUndefined();
  });

  it("scrolls a new message into view when the reader is at the bottom", () => {
    render("/messages/41");
    arrive(incoming);
    expect(list().scrollTop).toBe(1120);
    expect(pill()).toBeUndefined();
  });

  it("leaves a reader who has scrolled up where they are and offers New messages", () => {
    render("/messages/41");
    scrollTo(100);
    arrive(incoming);
    expect(list().scrollTop).toBe(100);
    expect(pill()).toBeDefined();
    act(() => pill()!.click());
    expect(list().scrollTop).toBe(1120);
    expect(pill()).toBeUndefined();
  });

  it("drops the pill once the reader scrolls down to the newest message themselves", () => {
    render("/messages/41");
    scrollTo(100);
    arrive(incoming);
    scrollTo(1120 - 30);
    expect(pill()).toBeUndefined();
  });

  it("takes the reader to the bottom for a message they sent, even from further up", () => {
    render("/messages/41");
    scrollTo(100);
    arrive({ ...incoming, id: 905, mine: true, sender: { user_id: 1, name: "Tunde" } });
    expect(list().scrollTop).toBe(1120);
    expect(pill()).toBeUndefined();
  });

  it("keeps the reader on the message they were reading when earlier ones load above it", async () => {
    mocks.page = { ...mocks.page, hasMore: true, nextBefore: 902 };
    mocks.fetchOlder.mockImplementation(async () => {
      listHeight = 1300;
      return { data: { results: [{ id: 900, body: "Hello", sender: { user_id: 1, name: "Tunde" }, sent_at: sentAt, mine: true }], hasMore: false } };
    });
    render("/messages/41");
    scrollTo(200);
    await act(async () => { (container.querySelector(".messages-earlier") as HTMLButtonElement).click(); });
    expect(list().scrollTop).toBe(500);
    expect(container.querySelectorAll(".messages-bubble")).toHaveLength(3);
  });
});

describe("read receipts", () => {
  const mineWith = (receipt: Record<string, unknown> | undefined) => ({
    id: 902, body: "Good morning, Mrs Okoro", sender: { user_id: 1, name: "Tunde" }, sent_at: sentAt, mine: true, ...(receipt ? { receipt } : {}),
  });
  const withMine = (receipt?: Record<string, unknown>) => {
    const page = mocks.page as { results: unknown[] };
    mocks.page = { ...page, results: [page.results[0], mineWith(receipt)] };
  };
  const labels = () => [...container.querySelectorAll('.messages-ticks[role="img"]')].map((n) => n.getAttribute("aria-label"));

  it("draws one tick for a stored message and two for a read one, only on the pupil's own", () => {
    mocks.row = row({ receipts: true });
    withMine({ state: "sent", read_count: 0, recipient_count: 1 });
    render("/messages/41");
    expect(labels()).toEqual(["Sent"]);
    expect(container.querySelector(".messages-ticks.is-sent svg")).not.toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    withMine({ state: "read", read_count: 1, recipient_count: 1 });
    render("/messages/41");
    expect(labels()).toEqual(["Read"]);
    expect(container.querySelector(".messages-bubble.is-theirs .messages-ticks")).toBeNull();
  });

  it("says how many have read when there is more than one reader", () => {
    mocks.row = row({ receipts: true });
    withMine({ state: "sent", read_count: 12, recipient_count: 40 });
    render("/messages/41");
    expect(labels()).toEqual(["Sent"]);
    act(() => root.unmount());
    root = createRoot(container);
    withMine({ state: "read", read_count: 40, recipient_count: 40 });
    render("/messages/41");
    expect(labels()).toEqual(["Read by 40 of 40"]);
  });

  it("draws nothing while the school does not show receipts, even if messages carry them", () => {
    withMine({ state: "read", read_count: 1, recipient_count: 1 });
    mocks.row = row({ receipts: false });
    render("/messages/41");
    expect(container.querySelectorAll(".messages-ticks")).toHaveLength(0);
    act(() => root.unmount());
    root = createRoot(container);
    mocks.row = row();
    render("/messages/41");
    expect(container.querySelectorAll(".messages-ticks")).toHaveLength(0);
  });

  it("shows a clock while a send is on its way, then the message with one tick", async () => {
    mocks.row = row({ receipts: true });
    let release: (m: unknown) => void = () => {};
    mocks.send.mockReturnValue({ unwrap: () => new Promise((resolve) => { release = resolve; }) });
    render("/messages/41");
    type(container.querySelector("textarea") as HTMLTextAreaElement, "On my way");
    await act(async () => { sendButton().click(); });
    expect(container.querySelector(".messages-bubble.is-outgoing")?.textContent).toContain("On my way");
    expect(labels()).toEqual(["Sending"]);
    await act(async () => {
      release({ id: 950, body: "On my way", sender: { user_id: 1, name: "Tunde" }, sent_at: sentAt, mine: true, receipt: { state: "sent", read_count: 0, recipient_count: 1 } });
    });
    expect(container.querySelector(".messages-bubble.is-outgoing")).toBeNull();
    expect([...container.querySelectorAll(".messages-bubble p")].map((p) => p.textContent)).toContain("On my way");
    expect(labels()).toEqual(["Sent"]);
  });

  it("marks a refused send Not sent, keeps the words and token, and retries from the message", async () => {
    mocks.send.mockReturnValueOnce({ unwrap: () => Promise.reject({ status: "FETCH_ERROR" }) });
    mocks.send.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    render("/messages/41");
    const box = container.querySelector("textarea") as HTMLTextAreaElement;
    type(box, "On my way");
    await act(async () => { sendButton().click(); });
    const retry = container.querySelector(".messages-retry") as HTMLButtonElement;
    expect(retry.textContent).toBe("Not sent. Tap to retry.");
    expect(box.value).toBe("On my way");
    await act(async () => { retry.click(); });
    const [first, again] = mocks.send.mock.calls.map((c) => c[0] as { clientToken: string });
    expect(again.clientToken).toBe(first.clientToken);
    expect(container.querySelector(".messages-retry")).toBeNull();
    expect(box.value).toBe("");
  });

  it("drops the Not sent message when the words are changed", async () => {
    mocks.send.mockReturnValue({ unwrap: () => Promise.reject({ status: "FETCH_ERROR" }) });
    render("/messages/41");
    const box = container.querySelector("textarea") as HTMLTextAreaElement;
    type(box, "On my way");
    await act(async () => { sendButton().click(); });
    expect(container.querySelector(".messages-retry")).not.toBeNull();
    type(box, "On my way now");
    expect(container.querySelector(".messages-retry")).toBeNull();
  });
});

describe("polling an open conversation", () => {
  const incoming = (id: number, mine = false) => ({
    id, body: `Message ${id}`, sender: { user_id: 9, name: "Mrs Funke Okoro" }, sent_at: sentAt, mine,
    ...(mine ? { receipt: { state: "sent", read_count: 0, recipient_count: 1 } } : {}),
  });
  const answer = (results: unknown[], receipts: unknown[] = [], hasMore = false) => ({ data: { results, hasMore, receipts } });
  const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const bodies = () => [...container.querySelectorAll(".messages-bubble p")].map((p) => p.textContent);
  const setVisible = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    mocks.row = row({ receipts: true, unread_count: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("does not poll at open, then asks every ten seconds for what is newer than the newest held", async () => {
    render("/messages/41");
    expect(mocks.poll).not.toHaveBeenCalled();
    await tick(10_000);
    expect(mocks.poll).toHaveBeenLastCalledWith({ id: 41, after: 903 }, false);
    mocks.poll.mockResolvedValueOnce(answer([incoming(904)]));
    await tick(10_000);
    await tick(10_000);
    expect(mocks.poll).toHaveBeenLastCalledWith({ id: 41, after: 904 }, false);
    expect(bodies()).toEqual(["Good morning, Mrs Okoro", "Please bring your workbook", "Message 904"]);
  });

  it("merges without duplicates and turns a tick from the receipts, never turning it back", async () => {
    const page = mocks.page as { results: Array<Record<string, unknown>> };
    mocks.page = { ...page, results: [page.results[0], { ...page.results[1], receipt: { state: "sent", read_count: 0, recipient_count: 1 } }] };
    render("/messages/41");
    const labels = () => [...container.querySelectorAll('.messages-ticks[role="img"]')].map((n) => n.getAttribute("aria-label"));
    expect(labels()).toEqual(["Sent"]);
    mocks.poll.mockResolvedValueOnce(answer([incoming(904)], [{ id: 902, state: "read", read_count: 1, recipient_count: 1 }]));
    await tick(10_000);
    expect(labels()).toEqual(["Read"]);
    mocks.poll.mockResolvedValueOnce(answer([incoming(904)], [{ id: 902, state: "sent", read_count: 0, recipient_count: 1 }]));
    await tick(10_000);
    expect(bodies().filter((b) => b === "Message 904")).toHaveLength(1);
    expect(labels()).toEqual(["Read"]);
  });

  it("keeps asking at once while the school says there are more", async () => {
    mocks.poll.mockResolvedValueOnce(answer([incoming(904)], [], true));
    mocks.poll.mockResolvedValueOnce(answer([incoming(905)]));
    render("/messages/41");
    await tick(10_000);
    expect(mocks.poll.mock.calls.map((c) => (c[0] as { after: number }).after)).toEqual([903, 904]);
    expect(bodies()).toContain("Message 905");
  });

  it("stops when the app goes into the background, and asks once on coming back", async () => {
    render("/messages/41");
    setVisible("hidden");
    await tick(30_000);
    expect(mocks.poll).not.toHaveBeenCalled();
    setVisible("visible");
    await tick(0);
    expect(mocks.poll).toHaveBeenCalledTimes(1);
  });

  it("asks once when the window is focused", async () => {
    render("/messages/41");
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(mocks.poll).toHaveBeenCalledTimes(1);
  });

  it("stops on leaving the conversation", async () => {
    render("/messages/41");
    act(() => root.unmount());
    root = createRoot(container);
    await tick(30_000);
    expect(mocks.poll).not.toHaveBeenCalled();
  });

  it("does not poll while offline", async () => {
    act(() => { store.dispatch(wentOffline()); });
    render("/messages/41");
    await tick(30_000);
    expect(mocks.poll).not.toHaveBeenCalled();
  });

  it("drops an answer that arrives after a different pupil is showing", async () => {
    act(() => { store.dispatch(sessionSettled({ status: "signed-in", pupils: [], active: "tunde" })); });
    let release: (value: unknown) => void = () => {};
    mocks.poll.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    render("/messages/41");
    await tick(10_000);
    expect(mocks.poll).toHaveBeenCalledTimes(1);
    act(() => { store.dispatch(sessionSettled({ status: "signed-in", pupils: [], active: "bola" })); });
    await act(async () => { release(answer([incoming(904)], [{ id: 902, state: "read", read_count: 1, recipient_count: 1 }])); });
    expect(bodies()).not.toContain("Message 904");
  });
});

describe("marking read only what has been seen", () => {
  const list = () => container.querySelector(".messages-scroll") as HTMLDivElement;
  const pill = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("New messages"));
  const scrollTo = (top: number) => act(() => { list().scrollTop = top; list().dispatchEvent(new Event("scroll")); });
  const arrival = { id: 904, body: "Message 904", sender: { user_id: 9, name: "Mrs Funke Okoro" }, sent_at: sentAt, mine: false };
  const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const setVisible = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  };

  beforeEach(() => { vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] }); });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  });

  it("marks the conversation read up to the newest message when it opens at the bottom", () => {
    render("/messages/41");
    expect(mocks.markRead).toHaveBeenCalledTimes(1);
    expect(mocks.markRead).toHaveBeenCalledWith({ id: 41, upTo: 903 });
  });

  it("marks a message that arrives while the reader is at the bottom", async () => {
    mocks.row = row({ unread_count: 0 });
    render("/messages/41");
    expect(mocks.markRead).not.toHaveBeenCalled();
    mocks.poll.mockResolvedValueOnce({ data: { results: [arrival], hasMore: false, receipts: [] } });
    await tick(10_000);
    expect(mocks.markRead).toHaveBeenLastCalledWith({ id: 41, upTo: 904 });
  });

  it("marks nothing new while New messages shows, and marks it when the pill is tapped", async () => {
    render("/messages/41");
    mocks.markRead.mockClear();
    scrollTo(100);
    mocks.poll.mockResolvedValueOnce({ data: { results: [arrival], hasMore: false, receipts: [] } });
    await tick(10_000);
    expect(pill()).toBeDefined();
    expect(mocks.markRead).not.toHaveBeenCalled();
    act(() => pill()!.click());
    expect(mocks.markRead).toHaveBeenCalledWith({ id: 41, upTo: 904 });
  });

  it("marks it when the reader scrolls down to it themselves", async () => {
    render("/messages/41");
    mocks.markRead.mockClear();
    scrollTo(100);
    mocks.poll.mockResolvedValueOnce({ data: { results: [arrival], hasMore: false, receipts: [] } });
    await tick(10_000);
    expect(mocks.markRead).not.toHaveBeenCalled();
    scrollTo(1000);
    expect(mocks.markRead).toHaveBeenCalledWith({ id: 41, upTo: 904 });
  });

  it("marks nothing while the app is in the background, and marks on coming back", () => {
    setVisible("hidden");
    render("/messages/41");
    expect(mocks.markRead).not.toHaveBeenCalled();
    setVisible("visible");
    expect(mocks.markRead).toHaveBeenCalledWith({ id: 41, upTo: 903 });
  });
});
