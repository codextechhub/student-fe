import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronUp, Lock } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

import { attemptFor, type SendAttempt } from "@/lib/client-token";
import { dayKey, formatDayLabel, formatTimeOfDay } from "@/lib/format";
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
} from "@/redux/services/messages-api";

import { MessageBox } from "./messages-box";

/** How often an open thread asks the school for new messages, in milliseconds. */
const THREAD_POLL_MS = 20_000;
/** How far from the bottom a reader may be and still be taken to a message that arrives. */
const NEAR_BOTTOM_PX = 400;

const POLLING = { pollingInterval: THREAD_POLL_MS, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true } as const;

/** Messages from both pages, each once, oldest first. */
function merged(older: ChatMessage[], latest: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const message of [...older, ...latest]) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * One conversation: the messages oldest to newest, a way to load earlier ones,
 * and the box to answer in.
 *
 * The newest page is read on a timer while the thread is open and again
 * whenever the app is brought back into view. Opening it marks it read, and
 * again whenever something new from the teacher arrives while it is open.
 * Earlier pages are fetched with the oldest message held as the cursor.
 * Offline the thread shows what was last seen and the box says sending waits
 * for a connection; a conversation the pupil can no longer write in shows the
 * school's reason where the box would be.
 */
export function MessageThread({ id }: { id: number }) {
  const offline = useAppSelector((s) => s.connectivity.offline);
  const { data: row, isError: rowFailed } = useConversationQuery(id, POLLING);
  const { data: latest, isLoading, isError, refetch } = useMessagesPageQuery({ id, before: null }, POLLING);
  const [fetchOlder, { isFetching: loadingOlder }] = useLazyMessagesPageQuery();
  const [markRead] = useMarkConversationReadMutation();
  const [older, setOlder] = useState<{ items: ChatMessage[]; hasMore: boolean } | null>(null);

  const messages = useMemo(() => merged(older?.items ?? [], latest?.results ?? []), [older, latest]);
  const hasMore = older ? older.hasMore : (latest?.hasMore ?? false);
  const newest = messages.at(-1);

  // Mark read when something unread is on screen.
  const readUpTo = useRef<number | null>(null);
  const unread = row?.unread_count ?? 0;
  useEffect(() => {
    if (offline || !unread || !newest || readUpTo.current === newest.id) return;
    readUpTo.current = newest.id;
    void markRead({ id });
  }, [offline, unread, newest, id, markRead]);

  // Start at the newest message; follow new ones only when the reader is near them or sent them.
  const scrolledFirst = useRef(false);
  const lastSeen = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!newest) return;
    const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight });
    if (!scrolledFirst.current) {
      scrolledFirst.current = true;
      lastSeen.current = newest.id;
      toBottom();
      return;
    }
    if (lastSeen.current === newest.id) return;
    lastSeen.current = newest.id;
    const gap = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    if (newest.mine || gap < NEAR_BOTTOM_PX) toBottom();
  }, [newest]);

  // Keep the reader's place when earlier messages are added above it.
  const heightBefore = useRef<number | null>(null);
  const heldOlder = older?.items.length ?? 0;
  useLayoutEffect(() => {
    if (heightBefore.current === null) return;
    window.scrollBy(0, document.documentElement.scrollHeight - heightBefore.current);
    heightBefore.current = null;
  }, [heldOlder]);

  const loadEarlier = async () => {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    heightBefore.current = document.documentElement.scrollHeight;
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
        <BackLink />
        <div className="messages-error" role="alert">
          {rowFailed ? "This conversation isn't available any more." : "Messages can't be shown right now."}{" "}
          <button type="button" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <section className="messages-thread" aria-label={name ? `Conversation with ${name}` : "Conversation"}>
      <BackLink />
      <header className="messages-thread-head">
        <h2>{name || " "}</h2>
        {row?.counterpart?.label && <p>{row.counterpart.label}</p>}
      </header>
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
            <Bubble message={message} />
          </Fragment>
        ))}
      </ol>
      {row && (row.can_send ? <Composer id={id} offline={offline} /> : <ReadOnlyNote reason={row.read_only_reason} />)}
    </section>
  );
}

function BackLink() {
  return (
    <Link to="/messages" className="messages-back">
      <ArrowLeft size={17} aria-hidden="true" />
      All messages
    </Link>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  return (
    <li className={cn("messages-bubble", message.mine ? "is-mine" : "is-theirs")}>
      <p>{message.body}</p>
      <time dateTime={message.sent_at}>{formatTimeOfDay(new Date(message.sent_at).getTime())}</time>
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
 * The reply box.
 *
 * The words keep one token until they change, so tapping Send twice, or again
 * after a dropped connection, stores the message once. A send the school
 * refuses leaves the words in the box.
 */
function Composer({ id, offline }: { id: number; offline: boolean }) {
  const dispatch = useAppDispatch();
  const [text, setText] = useState("");
  const [send, { isLoading }] = useSendMessageMutation();
  const attempt = useRef<SendAttempt | null>(null);
  const sending = useRef(false);

  const submit = async () => {
    const body = text.trim();
    if (sending.current || !body || offline) return;
    sending.current = true;
    attempt.current = attemptFor(attempt.current, body);
    try {
      await send({ id, body, clientToken: attempt.current.token }).unwrap();
      attempt.current = null;
      setText("");
    } catch (error) {
      toast.error(sendRefusalMessage(error));
      if ((error as { status?: unknown })?.status === 409) dispatch(messagesApi.util.invalidateTags(["Conversations"]));
    } finally {
      sending.current = false;
    }
  };

  return (
    <div className="messages-composer">
      <MessageBox
        id={`reply-${id}`}
        label="Your reply"
        value={text}
        onChange={setText}
        onSend={submit}
        busy={isLoading}
        blocked={offline ? "You're offline. Sending waits until you have a connection." : undefined}
      />
    </div>
  );
}
