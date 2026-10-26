import { Navigate, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";

import { MessageThread } from "./messages-thread";
import "./messages.css";

/** The conversation id in the address, or null when it is missing or not a whole number. */
function conversationId(raw: string | undefined): number | null {
  const id = raw ? Number(raw) : null;
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * An open conversation with a teacher or the school office (design 2k), a
 * screen of its own at every size: the app shell's header and tab bar step
 * aside, the thread fills the visible height, and its own header carries the
 * way back to the Inbox. The list of conversations is the Inbox's, so an
 * address with no conversation goes there.
 */
export function MessagesPage() {
  const openId = conversationId(useParams().id);
  if (openId === null) return <Navigate to="/inbox?show=messages" replace />;
  return (
    <PageShell className="messages-page has-conversation">
      <MessageThread key={openId} id={openId} />
    </PageShell>
  );
}
