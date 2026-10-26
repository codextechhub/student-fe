import { useState } from "react";
import { ChevronDown, Eye, MessageSquare, PenSquare } from "lucide-react";
import { Link, useMatch, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { formatWhen } from "@/lib/format";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";
import {
  OVERSIGHT_FALLBACK,
  useConversationsQuery,
  type Conversation,
} from "@/redux/services/messages-api";

import { NewMessageSheet } from "./messages-new";
import { MessageThread } from "./messages-thread";
import "./messages.css";

/** The conversation id in the address, or null when it is missing or not a whole number. */
function conversationId(raw: string | undefined): number | null {
  const id = raw ? Number(raw) : null;
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * The pupil's messages with their teachers and the school office.
 *
 * One list of conversations and, beside it on a wide screen, the thread that
 * is open; on a phone the list and the thread take the screen in turn. An open
 * thread is a fixed column (see `MessageThread`) that fills the space the app
 * shell leaves it, and the list beside it scrolls on its own. The
 * school's notice that a parent or guardian and the school can read these
 * messages sits at the top of the list, in plain sight. Starting a message
 * opens a sheet over the list, from the bottom of the screen on a phone.
 */
export function MessagesPage() {
  const { id } = useParams();
  const openId = conversationId(id);
  const composing = useMatch("/messages/new") !== null;
  const [pages, setPages] = useState(1);
  const { data: first, isLoading, isError, refetch } = useConversationsQuery(1);
  const unread = first?.unreadCount ?? 0;

  return (
    <PageShell className={cn("messages-page", openId !== null && "has-conversation")}>
      <div className="messages-wrap">
        <div className="messages-layout">
          <div className={cn("messages-list-panel", openId !== null && "is-hidden-on-detail")}>
            <section className="messages-cover" aria-label="Messages summary">
              <div>
                <span className="messages-cover-label">Messages</span>
                <h2>{first ? (unread > 0 ? `${unread} unread` : "All read") : "Your teachers"}</h2>
              </div>
              <Link to="/messages/new" className="messages-new-button">
                <PenSquare size={17} aria-hidden="true" />
                New message
              </Link>
            </section>
            <p className="messages-oversight" role="note">
              <Eye size={18} aria-hidden="true" />
              <span>{first?.oversightNotice ?? OVERSIGHT_FALLBACK}</span>
            </p>
            {isLoading && !first && <div className="messages-loading" role="status" aria-label="Loading messages" />}
            {isError && !first && (
              <div className="messages-error" role="alert">
                Messages can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button>
              </div>
            )}
            {first && first.rows.length === 0 && (
              <div className="messages-empty">
                <span className="messages-empty-icon"><MessageSquare size={25} aria-hidden="true" /></span>
                <h2>No messages yet</h2>
                <p>Write to one of your teachers or the school office, and the conversation will be kept here.</p>
              </div>
            )}
            {first && first.rows.length > 0 && (
              <>
                <ul className="messages-list">
                  {Array.from({ length: pages }, (_, index) => (
                    <ConversationRows key={index + 1} page={index + 1} openId={openId} />
                  ))}
                </ul>
                <MoreButton pages={pages} onMore={() => setPages((value) => value + 1)} />
              </>
            )}
          </div>
          <div className={cn("messages-detail-panel", openId === null && "is-hidden-on-list")}>
            {openId !== null ? <MessageThread key={openId} id={openId} /> : <ChooseOne />}
          </div>
        </div>
      </div>
      <NewMessageSheet open={composing} />
    </PageShell>
  );
}

function ConversationRows({ page, openId }: { page: number; openId: number | null }) {
  const { data } = useConversationsQuery(page);
  return <>{data?.rows.map((row) => <ConversationRow key={row.id} row={row} selected={row.id === openId} />)}</>;
}

function ConversationRow({ row, selected }: { row: Conversation; selected: boolean }) {
  const name = row.display_name || row.counterpart?.name || "Conversation";
  const last = row.last_message;
  const unread = row.unread_count > 0;
  return (
    <li className={cn("messages-row", unread && "is-unread", selected && "is-selected")}>
      <Link
        to={`/messages/${row.id}`}
        aria-label={`Open the conversation with ${name}${unread ? `, ${row.unread_count} unread` : ""}`}
      >
        <span className="messages-avatar" aria-hidden="true">{initialsOf(name)}</span>
        <span className="messages-row-main">
          <span className="messages-row-top">
            <strong className="messages-row-name">{name}</strong>
            {last && <time dateTime={last.sent_at}>{formatWhen(last.sent_at)}</time>}
          </span>
          {row.counterpart?.label && <span className="messages-row-label">{row.counterpart.label}</span>}
          <span className="messages-row-bottom">
            <span className="messages-row-preview">
              {last ? `${last.mine ? "You: " : ""}${last.preview}` : "No messages yet"}
            </span>
            {unread && <span className="messages-badge" aria-hidden="true">{row.unread_count > 99 ? "99+" : row.unread_count}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Show older conversations only while the latest loaded page has another page. */
function MoreButton({ pages, onMore }: { pages: number; onMore: () => void }) {
  const { data } = useConversationsQuery(pages);
  if (!data?.next) return null;
  return (
    <button type="button" className="messages-older" onClick={onMore}>
      Show older conversations <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

/** The wide screen's right pane before a conversation is opened. */
function ChooseOne() {
  return (
    <div className="messages-choose">
      <span className="messages-empty-icon"><MessageSquare size={25} aria-hidden="true" /></span>
      <h2>Choose a conversation</h2>
      <p>Open one from the list, or start a new message.</p>
    </div>
  );
}
