import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronLeft, ChevronUp, Lock } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { attemptFor, type SendAttempt } from "@/lib/client-token";
import { dayKey, formatDayLabel, formatTimeOfDay } from "@/lib/format";
import { initialsOf } from "@/lib/initials";
import { toneFor } from "@/lib/name-hue";
import { usePageVisible } from "@/lib/page-visible";
import { betterReceipt } from "@/lib/receipts";
import { sendRefusalMessage } from "@/lib/send-refusal";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  messagesApi,
  useConversationQuery,
  useLazyMessagesPageQuery,
  useMarkConversationReadMutation,
  useMessagesPageQuery,
  useSendMessageMutation,
  type ChatMessage,
  type PollAnswer,
  type Receipt,
} from "@/redux/services/messages-api";

import { MessageBox } from "./messages-box";
import { SendingClock, Ticks } from "./messages-ticks";
import { useThreadPoll } from "./use-thread-poll";

/** How often the conversation's own row (its read-only state, its unread count) is read, in milliseconds. */
const ROW_POLL_MS = 20_000;
/** How far from the newest message, in px, a reader still counts as being at the bottom. */
const AT_BOTTOM_PX = 120;

const ROW_POLLING = { pollingInterval: ROW_POLL_MS, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true } as const;

/** What the thread has shown of a send that has not been stored yet. */
type Outgoing = { body: string; failed: boolean };

/**
 * Messages from every source, each once, oldest first.
 *
 * Later sources win for the message itself, but a receipt only ever moves
 * forward: whichever copy has read the message more keeps its tick, whether it
 * came from a page, a poll or a poll's receipt list.
 */
function merged(sources: ChatMessage[][], receipts: Map<number, Receipt>): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const message of sources.flat()) {
    const held = byId.get(message.id);
    byId.set(message.id, held ? { ...message, receipt: betterReceipt(held.receipt, message.receipt) } : message);
  }
  return [...byId.values()]
    .sort((a, b) => a.id - b.id)
    .map((message) => {
      const told = receipts.get(message.id);
      return message.mine && told ? { ...message, receipt: betterReceipt(message.receipt, told) } : message;
    });
}

/**
 * One conversation, laid out as a fixed column: the teacher's name pinned at the
 * top, the box to answer in pinned at the bottom, and the messages, oldest to
 * newest, scrolling between them. Only the message list moves; the page, the
 * header and the box stay where they are, and the column takes its height from
 * the app shell, which follows the visible screen above the phone keyboard.
 *
 * The list opens on the newest message. A message that arrives scrolls into
 * view when the reader is at the bottom or sent it; otherwise a "New messages"
 * button appears and takes them down. Loading earlier messages keeps the reader
 * on the message they were reading.
 *
 * While the thread is open and the app is in front it polls every ten seconds
 * for what is newer than the newest message held (see `useThreadPoll`), which
 * brings new messages and the ticks on the pupil's own; the answers are merged
 * with the newest page and the earlier pages, each message once. A tick is
 * drawn only while the school shows receipts to the pupil (`row.receipts`).
 * Earlier pages are fetched with the oldest message held as the cursor.
 *
 * A message counts as read only when it has been seen: the conversation is
 * marked read up to the newest message when the reader is at the bottom of the
 * list with the app in front, and again when they scroll down or tap "New
 * messages". While that button shows, nothing new is marked read.
 *
 * A send shows at once as a message with a clock; a send the school refuses
 * shows as "Not sent. Tap to retry." with the words kept in the box and the
 * same token, so retrying stores the message once.
 * Offline the thread shows what was last seen and the box says sending waits
 * for a connection; a conversation the pupil can no longer write in shows the
 * school's reason where the box would be.
 */
export function MessageThread({ id }: { id: number }) {
  const dispatch = useAppDispatch();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const visible = usePageVisible();
  const { data: row, isError: rowFailed } = useConversationQuery(id, ROW_POLLING);
  const { data: latest, isLoading, isError, refetch } = useMessagesPageQuery({ id, before: null }, { refetchOnReconnect: true });
  const [fetchOlder, { isFetching: loadingOlder }] = useLazyMessagesPageQuery();
  const [markRead] = useMarkConversationReadMutation();
  const [send] = useSendMessageMutation();
  const [older, setOlder] = useState<{ items: ChatMessage[]; hasMore: boolean } | null>(null);
  const [polled, setPolled] = useState<ChatMessage[]>([]);
  const [told, setTold] = useState<Map<number, Receipt>>(() => new Map());
  const [text, setText] = useState("");
  const [outgoing, setOutgoing] = useState<Outgoing | null>(null);

  const messages = useMemo(() => merged([older?.items ?? [], latest?.results ?? [], polled], told), [older, latest, polled, told]);
  const hasMore = older ? older.hasMore : (latest?.hasMore ?? false);
  const newest = messages.at(-1);
  const receiptsOn = row?.receipts === true;

  const take = useCallback((answer: PollAnswer) => {
    if (answer.results.length) setPolled((held) => [...held, ...answer.results]);
    if (answer.receipts.length) {
      setTold((held) => {
        const next = new Map(held);
        for (const update of answer.receipts) next.set(update.id, betterReceipt(next.get(update.id), update) as Receipt);
        return next;
      });
    }
  }, []);
  useThreadPoll({ id, newestId: newest?.id ?? null, enabled: !offline, onAnswer: take });

  // Mark read up to the newest message, but only once it has been seen.
  const [bottomSeen, setBottomSeen] = useState(true);
  const readUpTo = useRef<number | null>(null);
  const firstNewest = useRef<number | null>(null);
  const unread = row?.unread_count ?? 0;
  useEffect(() => {
    if (offline || !visible || !bottomSeen || !newest || readUpTo.current === newest.id) return;
    const arrived = !newest.mine && newest.id > (firstNewest.current ?? newest.id);
    if (!unread && !arrived) return;
    readUpTo.current = newest.id;
    void markRead({ id, upTo: newest.id });
  }, [offline, visible, bottomSeen, unread, newest, id, markRead]);

  const sending = useRef(false);
  const attempt = useRef<SendAttempt | null>(null);
  const submit = async () => {
    const body = text.trim();
    if (sending.current || !body || offline) return;
    sending.current = true;
    attempt.current = attemptFor(attempt.current, body);
    setOutgoing({ body, failed: false });
    try {
      const sent = await send({ id, body, clientToken: attempt.current.token }).unwrap();
      attempt.current = null;
      if (typeof sent?.id === "number") setPolled((held) => [...held, sent]);
      setText("");
      setOutgoing(null);
    } catch (error) {
      toast.error(sendRefusalMessage(error));
      setOutgoing({ body, failed: true });
      if ((error as { status?: unknown })?.status === 409) dispatch(messagesApi.util.invalidateTags(["Conversations"]));
    } finally {
      sending.current = false;
    }
  };
  // Changing the words drops a failed send: it is no longer what would be retried.
  const change = (next: string) => {
    setText(next);
    setOutgoing((held) => (held?.failed && next.trim() !== held.body ? null : held));
  };

  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [unseen, setUnseen] = useState(false);

  const toBottom = useCallback(() => {
    const list = scroller.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    atBottom.current = true;
    setUnseen(false);
    setBottomSeen(true);
  }, []);

  const onScroll = () => {
    const list = scroller.current;
    if (!list) return;
    atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < AT_BOTTOM_PX;
    setBottomSeen(atBottom.current);
    if (atBottom.current) setUnseen(false);
  };

  // Start at the newest message; follow new ones when the reader is at the bottom or sent them.
  const scrolledFirst = useRef(false);
  const lastSeen = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!newest) return;
    if (!scrolledFirst.current) {
      scrolledFirst.current = true;
      lastSeen.current = newest.id;
      firstNewest.current = newest.id;
      toBottom();
      return;
    }
    if (lastSeen.current === newest.id) return;
    lastSeen.current = newest.id;
    if (newest.mine || atBottom.current) toBottom();
    else {
      setUnseen(true);
      setBottomSeen(false);
    }
  }, [newest, toBottom]);

  // A message the pupil is sending goes to the bottom, where they will see it land.
  useLayoutEffect(() => {
    if (outgoing) toBottom();
  }, [outgoing, toBottom]);

  // Stay on the newest message when the list is resized (keyboard, taller box) from the bottom.
  useEffect(() => {
    const list = scroller.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => {
      if (atBottom.current) list.scrollTop = list.scrollHeight;
    });
    watch.observe(list);
    return () => watch.disconnect();
  }, []);

  // Keep the reader's place when earlier messages are added above it.
  const heightBefore = useRef<number | null>(null);
  const heldOlder = older?.items.length ?? 0;
  useLayoutEffect(() => {
    const list = scroller.current;
    if (heightBefore.current === null || !list) return;
    list.scrollTop += list.scrollHeight - heightBefore.current;
    heightBefore.current = null;
  }, [heldOlder]);

  const loadEarlier = async () => {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    heightBefore.current = scroller.current?.scrollHeight ?? null;
    const result = await fetchOlder({ id, before: oldest.id });
    if (!result.data) {
      heightBefore.current = null;
      toast.error(offline || result.error ? "Earlier messages can't be loaded right now." : "Try again in a moment.");
      return;
    }
    const page = result.data;
    setOlder((held) => ({ items: [...(held?.items ?? []), ...page.results], hasMore: page.hasMore }));
  };

  const name = row?.display_name || row?.counterpart?.name || "";

  if (isError && !latest) {
    return (
      <div className="messages-thread">
        <header className="messages-thread-head"><BackLink /></header>
        <div className="messages-error" role="alert">
          {rowFailed ? "This conversation isn't available any more." : "Messages can't be shown right now."}{" "}
          <button type="button" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <section className="messages-thread" aria-label={name ? `Conversation with ${name}` : "Conversation"}>
      <header className="messages-thread-head">
        <BackLink />
        {name && <span className="messages-thread-avatar" style={toneFor(name)} aria-hidden="true">{initialsOf(name)}</span>}
        <div className="messages-thread-title">
          <h2>{name || " "}</h2>
          {row?.counterpart?.label && <p>{row.counterpart.label}</p>}
        </div>
      </header>
      <div className="messages-scroll-wrap">
        <div ref={scroller} className="messages-scroll" onScroll={onScroll}>
          {isLoading && !latest && <div className="messages-loading" role="status" aria-label="Loading messages" />}
          {latest && messages.length === 0 && <p className="messages-thread-empty">No messages yet. Say hello below.</p>}
          {hasMore && (
            <button type="button" className="messages-earlier" onClick={loadEarlier} disabled={loadingOlder}>
              <ChevronUp size={16} aria-hidden="true" />
              {loadingOlder ? "Loading…" : "Earlier messages"}
            </button>
          )}
          <ol className="messages-bubbles" aria-live="polite">
            {messages.map((message, index) => (
              <Fragment key={message.id}>
                {(index === 0 || dayKey(messages[index - 1].sent_at) !== dayKey(message.sent_at)) && (
                  <li className="messages-day"><span>{formatDayLabel(message.sent_at)}</span></li>
                )}
                <Bubble message={message} receipts={receiptsOn} />
              </Fragment>
            ))}
            {outgoing && <OutgoingBubble outgoing={outgoing} receipts={receiptsOn} onRetry={submit} />}
          </ol>
        </div>
        {unseen && (
          <button type="button" className="messages-new-pill" onClick={toBottom}>
            <ArrowDown size={15} aria-hidden="true" />
            New messages
          </button>
        )}
      </div>
      {row && (row.can_send ? (
        <Composer id={id} offline={offline} text={text} onChange={change} onSend={submit} busy={!!outgoing && !outgoing.failed} />
      ) : (
        <ReadOnlyNote reason={row.read_only_reason} />
      ))}
    </section>
  );
}

/** The way back to the Inbox. */
function BackLink() {
  return (
    <Link to="/inbox" className="messages-back" aria-label="Inbox">
      <ChevronLeft size={22} aria-hidden="true" />
    </Link>
  );
}

function Bubble({ message, receipts }: { message: ChatMessage; receipts: boolean }) {
  return (
    <li className={cn("messages-bubble", message.mine ? "is-mine" : "is-theirs")}>
      <p>{message.body}</p>
      <div className="messages-meta">
        <time dateTime={message.sent_at}>{formatTimeOfDay(new Date(message.sent_at).getTime())}</time>
        {receipts && message.mine && message.receipt && <Ticks receipt={message.receipt} />}
      </div>
    </li>
  );
}

/** The pupil's message on its way to the school, or one the school did not take. */
function OutgoingBubble({ outgoing, receipts, onRetry }: { outgoing: Outgoing; receipts: boolean; onRetry: () => void }) {
  return (
    <li className={cn("messages-bubble is-mine is-outgoing", outgoing.failed && "is-failed")}>
      <p>{outgoing.body}</p>
      {outgoing.failed ? (
        <button type="button" className="messages-retry" onClick={onRetry}>Not sent. Tap to retry.</button>
      ) : (
        <div className="messages-meta">{receipts ? <SendingClock /> : <span className="messages-sending-label">Sending…</span>}</div>
      )}
    </li>
  );
}

function ReadOnlyNote({ reason }: { reason: string }) {
  return (
    <p className="messages-readonly" role="status">
      <Lock size={17} aria-hidden="true" />
      <span>{reason || "You can read this conversation but not write in it."}</span>
    </p>
  );
}

/**
 * The reply box, over the thread's own send (see `MessageThread`).
 *
 * The words keep one token until they change, so tapping Send twice, or again
 * after a dropped connection, stores the message once. A send the school
 * refuses leaves the words in the box.
 */
function Composer({ id, offline, text, onChange, onSend, busy }: {
  id: number;
  offline: boolean;
  text: string;
  onChange: (text: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  return (
    <div className="messages-composer">
      <MessageBox
        compact
        id={`reply-${id}`}
        label="Your reply"
        value={text}
        onChange={onChange}
        onSend={onSend}
        busy={busy}
        blocked={offline ? "You're offline. Sending waits until you have a connection." : undefined}
      />
    </div>
  );
}
