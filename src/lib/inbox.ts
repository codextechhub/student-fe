import type { Conversation } from "@/redux/services/messages-api";
import type { Notice } from "@/redux/services/portal-api";

/** Which of the Inbox's lists is showing: both, or one of them. */
export type InboxShow = "all" | "notices" | "messages";

/** The filter in the address (`/inbox?show=notices`), so Back returns to it; anything else is everything. */
export function inboxShow(raw: string | null): InboxShow {
  return raw === "notices" || raw === "messages" ? raw : "all";
}

/** One row of the Inbox: a notice, or a conversation at its latest message. */
export type InboxEntry =
  | { kind: "notice"; at: string; notice: Notice }
  | { kind: "message"; at: string; conversation: Conversation };

/** One source's loaded rows, newest first, and whether the school has older ones. */
export type InboxSource<T> = { rows: T[]; more: boolean };

const time = (at: string) => {
  const value = Date.parse(at);
  return Number.isNaN(value) ? 0 : value;
};

/**
 * Notices and conversations in one list, newest first.
 *
 * Each comes from the school a page at a time, newest first. Where one source
 * has older pages still to read, nothing older than the oldest row read from
 * it can be placed yet: an unread page of notices may hold one newer than a
 * conversation already read. So the list stops at the newest such edge, and
 * "Show older" reads on. A source that is not showing, or not loaded yet, is
 * `null` and takes no part.
 */
export function mergeInbox(
  notices: InboxSource<Notice> | null,
  conversations: InboxSource<Conversation> | null,
): { entries: InboxEntry[]; more: boolean } {
  const entries: InboxEntry[] = [
    ...(notices?.rows ?? []).map((notice): InboxEntry => ({ kind: "notice", at: notice.published_at, notice })),
    ...(conversations?.rows ?? []).map(
      (conversation): InboxEntry => ({
        kind: "message",
        at: conversation.last_message?.sent_at ?? conversation.last_activity_at,
        conversation,
      }),
    ),
  ].sort((a, b) => time(b.at) - time(a.at));
  const edges = [notices, conversations]
    .filter((source): source is InboxSource<Notice> | InboxSource<Conversation> => !!source?.more && source.rows.length > 0)
    .map((source) => {
      const last = source.rows[source.rows.length - 1];
      return time("published_at" in last ? last.published_at : (last.last_message?.sent_at ?? last.last_activity_at));
    });
  const edge = edges.length ? Math.max(...edges) : null;
  return {
    entries: edge === null ? entries : entries.filter((entry) => time(entry.at) >= edge),
    more: edges.length > 0,
  };
}
