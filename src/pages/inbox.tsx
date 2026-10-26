import { useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronDown, Eye, Inbox as InboxIcon, PenSquare } from "lucide-react";
import { Link, useMatch, useSearchParams } from "react-router";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/page-shell";
import { ScreenTitle } from "@/components/layout/screen";
import { Segmented } from "@/components/layout/segmented";
import { formatRowWhen } from "@/lib/format";
import { inboxShow, mergeInbox, type InboxEntry, type InboxShow, type InboxSource } from "@/lib/inbox";
import { initialsOf } from "@/lib/initials";
import { toneFor } from "@/lib/name-hue";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  OVERSIGHT_FALLBACK,
  useConversationsQuery,
  useUnreadMessagesQuery,
  type Conversation,
  type ConversationPage,
} from "@/redux/services/messages-api";
import {
  refusal,
  useMarkAllNoticesReadMutation,
  useNoticesQuery,
  type Notice,
  type NoticePage,
} from "@/redux/services/portal-api";

import { NewMessageSheet } from "./messages-new";
import "./inbox.css";

const FILTERS: { key: InboxShow; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notices", label: "Notices" },
  { key: "messages", label: "Messages" },
];

/**
 * The screen behind the Inbox button: the school's notices and the pupil's
 * conversations in one list, newest first, with a switch for All, Notices or
 * Messages (kept in the address, so Back returns to it). A notice opens the
 * notice, whose screen marks it read; a conversation opens the thread, which
 * marks itself read as the pupil reads it.
 *
 * "Mark all as read" covers notices only. Marking a conversation read tells
 * the teacher the pupil has read it (the ticks in a thread), so a
 * conversation is read by opening it, never by a sweep.
 *
 * New message opens the sheet over this list at `/inbox/new`.
 */
export function InboxPage() {
  const [params, setParams] = useSearchParams();
  const show = inboxShow(params.get("show"));
  const composing = useMatch("/inbox/new") !== null;
  const offline = useAppSelector((s) => s.connectivity.offline);
  const [noticePages, setNoticePages] = useState(1);
  const [conversationPages, setConversationPages] = useState(1);
  const withNotices = show !== "messages";
  const withMessages = show !== "notices";

  const noticesFirst = useNoticesQuery(1);
  const conversationsFirst = useConversationsQuery(1);
  const { data: messagesUnread = 0 } = useUnreadMessagesQuery();
  const noticesUnread = noticesFirst.data?.unreadCount ?? 0;
  const [markAll, { isLoading: markingAll }] = useMarkAllNoticesReadMutation();

  // The first page of each is read here; later pages by the loaders below, which hand them up.
  const [laterNotices, setLaterNotices] = useState<Record<number, NoticePage>>({});
  const [laterConversations, setLaterConversations] = useState<Record<number, ConversationPage>>({});
  const noticeData = Array.from({ length: noticePages }, (_, i) => (i === 0 ? noticesFirst.data : laterNotices[i + 1]));
  const conversationData = Array.from({ length: conversationPages }, (_, i) => (i === 0 ? conversationsFirst.data : laterConversations[i + 1]));
  const noticeSource: InboxSource<Notice> | null = withNotices && noticeData[0]
    ? { rows: noticeData.flatMap((page) => page?.notices ?? []), more: !!noticeData[noticeData.length - 1]?.next }
    : null;
  const conversationSource: InboxSource<Conversation> | null = withMessages && conversationData[0]
    ? { rows: conversationData.flatMap((page) => page?.rows ?? []), more: !!conversationData[conversationData.length - 1]?.next }
    : null;
  const { entries, more } = mergeInbox(noticeSource, conversationSource);

  const counts: Record<InboxShow, number> = { all: noticesUnread + messagesUnread, notices: noticesUnread, messages: messagesUnread };
  const loading = (withNotices && noticesFirst.isLoading && !noticesFirst.data) || (withMessages && conversationsFirst.isLoading && !conversationsFirst.data);
  const noticesFailed = withNotices && noticesFirst.isError && !noticesFirst.data;
  const messagesFailed = withMessages && conversationsFirst.isError && !conversationsFirst.data;
  const settled = !loading && (!withNotices || !!noticesFirst.data || noticesFailed) && (!withMessages || !!conversationsFirst.data || messagesFailed);
  const latestNoticePage = noticeData[noticeData.length - 1];
  const latestConversationPage = conversationData[conversationData.length - 1];

  const choose = (key: InboxShow) => setParams(key === "all" ? {} : { show: key }, { replace: true });
  const showOlder = () => {
    if (withNotices && latestNoticePage?.next) setNoticePages((n) => n + 1);
    if (withMessages && latestConversationPage?.next) setConversationPages((n) => n + 1);
  };
  const readAll = async () => {
    try {
      await markAll().unwrap();
      toast.success("All notices marked as read");
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <PageShell className="inbox-page">
      {Array.from({ length: noticePages - 1 }, (_, i) => (
        <LaterNotices key={i} page={i + 2} onPage={(page, data) => setLaterNotices((pages) => ({ ...pages, [page]: data }))} />
      ))}
      {Array.from({ length: conversationPages - 1 }, (_, i) => (
        <LaterConversations key={i} page={i + 2} onPage={(page, data) => setLaterConversations((pages) => ({ ...pages, [page]: data }))} />
      ))}
      <div className="inbox-wrap">
        <ScreenTitle
          title="Inbox"
          eyebrow={counts.all ? `${counts.all} unread` : "All caught up"}
          eyebrowClassName="inbox-eyebrow"
          action={<Link to={show === "all" ? "/inbox/new" : `/inbox/new?show=${show}`} className="inbox-new"><PenSquare size={16} aria-hidden="true" />New message</Link>}
        />

        <Segmented
          className="inbox-filters"
          label="Show"
          value={show}
          onChange={choose}
          options={FILTERS.map((filter) => ({ key: filter.key, label: counts[filter.key] > 0 ? `${filter.label} · ${counts[filter.key]}` : filter.label }))}
        />

        {withMessages && (
          <p className="inbox-oversight" role="note">
            <Eye size={16} aria-hidden="true" />
            <span>{conversationsFirst.data?.oversightNotice ?? OVERSIGHT_FALLBACK}</span>
          </p>
        )}

        {withNotices && noticesUnread > 0 && (
          <div className="inbox-mark-all">
            <button type="button" onClick={readAll} disabled={markingAll || offline}>
              <CheckCheck size={15} aria-hidden="true" />
              {markingAll ? "Marking…" : show === "notices" ? "Mark all as read" : "Mark all notices read"}
            </button>
          </div>
        )}

        {noticesFailed && <Failed what="Notices" onRetry={() => noticesFirst.refetch()} />}
        {messagesFailed && <Failed what="Messages" onRetry={() => conversationsFirst.refetch()} />}
        {loading && <div className="inbox-loading" role="status" aria-label="Loading your inbox" />}

        {entries.length > 0 && (
          <ul className="inbox-list">
            {entries.map((entry) => <Row key={entry.kind === "notice" ? `n${entry.notice.id}` : `m${entry.conversation.id}`} entry={entry} />)}
          </ul>
        )}
        {settled && entries.length === 0 && !noticesFailed && !messagesFailed && <Empty show={show} />}
        {more && (
          <button type="button" className="inbox-older" onClick={showOlder}>
            Show older <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <NewMessageSheet open={composing} closeTo={show === "all" ? "/inbox" : `/inbox?show=${show}`} />
    </PageShell>
  );
}

/** Reads a later page of notices and hands it to the Inbox, again whenever it is read afresh. */
function LaterNotices({ page, onPage }: { page: number; onPage: (page: number, data: NoticePage) => void }) {
  const { data } = useNoticesQuery(page);
  useEffect(() => {
    if (data) onPage(page, data);
    // onPage is a fresh closure each render; only new data matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, page]);
  return null;
}

/** Reads a later page of conversations and hands it to the Inbox, again whenever it is read afresh. */
function LaterConversations({ page, onPage }: { page: number; onPage: (page: number, data: ConversationPage) => void }) {
  const { data } = useConversationsQuery(page);
  useEffect(() => {
    if (data) onPage(page, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, page]);
  return null;
}

function Row({ entry }: { entry: InboxEntry }) {
  return entry.kind === "notice" ? <NoticeRow notice={entry.notice} /> : <ConversationRow row={entry.conversation} />;
}

function NoticeRow({ notice }: { notice: Notice }) {
  return (
    <li>
      <Link
        to={`/notices/${notice.id}`}
        className={cn("inbox-row", notice.unread && "is-unread")}
        aria-label={`Notice: ${notice.title}${notice.unread ? ", unread" : ""}`}
      >
        <span className="inbox-row-mark inbox-row-mark--notice"><Bell size={20} aria-hidden="true" /></span>
        <span className="inbox-row-main">
          <span className="inbox-row-top">
            <strong>{notice.title}</strong>
            <time dateTime={notice.published_at}>{formatRowWhen(notice.published_at)}</time>
          </span>
          <span className="inbox-row-sub">
            {notice.audience_label}
            {notice.edited_at && <span className="pill pill--warn inbox-edited">Edited</span>}
          </span>
          <span className="inbox-row-body">{notice.body}</span>
        </span>
        {notice.unread && <span className="inbox-row-dot" aria-hidden="true" />}
      </Link>
    </li>
  );
}

function ConversationRow({ row }: { row: Conversation }) {
  const name = row.display_name || row.counterpart?.name || "Conversation";
  const last = row.last_message;
  const unread = row.unread_count > 0;
  return (
    <li>
      <Link
        to={`/messages/${row.id}`}
        className={cn("inbox-row", unread && "is-unread")}
        aria-label={`Conversation with ${name}${unread ? `, ${row.unread_count} unread` : ""}`}
      >
        <span className="inbox-row-mark" style={toneFor(name)} aria-hidden="true">{initialsOf(name)}</span>
        <span className="inbox-row-main">
          <span className="inbox-row-top">
            <strong>{name}</strong>
            <time dateTime={last?.sent_at ?? row.last_activity_at}>{formatRowWhen(last?.sent_at ?? row.last_activity_at)}</time>
          </span>
          {row.counterpart?.label && <span className="inbox-row-sub">{row.counterpart.label}</span>}
          <span className="inbox-row-body">{last ? `${last.mine ? "You: " : ""}${last.preview}` : "No messages yet"}</span>
        </span>
        {unread && <span className="inbox-row-dot" aria-hidden="true" />}
      </Link>
    </li>
  );
}

function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="inbox-failed" role="alert">
      {what} can&apos;t be shown right now. <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}

const EMPTY: Record<InboxShow, { title: string; text: string }> = {
  all: { title: "Nothing here yet", text: "Your school's notices and your messages with teachers will appear here." },
  notices: { title: "No notices yet", text: "Your school's updates will appear here when they are posted." },
  messages: { title: "No messages yet", text: "Write to one of your teachers or the school office, and the conversation will be kept here." },
};

function Empty({ show }: { show: InboxShow }) {
  return (
    <div className="inbox-empty">
      <span className="icon-tile"><InboxIcon size={22} aria-hidden="true" /></span>
      <h2>{EMPTY[show].title}</h2>
      <p>{EMPTY[show].text}</p>
    </div>
  );
}
