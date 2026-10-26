import { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { DetailBar } from "@/components/layout/screen";
import { formatTimestampDate } from "@/lib/format";
import { useAppSelector } from "@/redux/hooks";
import { useMarkNoticeReadMutation, useNoticeQuery, type Notice } from "@/redux/services/portal-api";

import "./notices.css";

/** The notice id in the address, or null when it is missing or not a whole number. */
function noticeId(raw: string | undefined): number | null {
  const id = raw ? Number(raw) : null;
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * One school notice, opened from the Inbox, Home or a notification: a screen
 * of its own with a back bar to the Inbox, the notice whole in one card.
 *
 * A notice is read once it is opened, however it was reached, so this screen
 * marks it read as it shows it (the Inbox and Home only open it). Offline it
 * stays unread and is marked when the connection returns while it is still
 * open. The list of notices is the Inbox's.
 */
export function NoticesPage() {
  const id = noticeId(useParams().id);
  return (
    <PageShell className="notice-page">
      <DetailBar title="Notice" back="/inbox" backLabel="Back to the inbox" />
      <div className="notice-wrap">
        {id === null ? <Missing /> : <NoticeView id={id} />}
      </div>
    </PageShell>
  );
}

function NoticeView({ id }: { id: number }) {
  const { data: notice, isError } = useNoticeQuery(id);
  useReadOnOpen(notice);

  if (isError) return <Missing />;
  if (!notice) return <div className="notice-loading" role="status" aria-label="Loading notice" />;
  return (
    <article className="screen-card notice-card">
      <div className="notice-top">
        <span className="notice-audience"><Bell size={14} aria-hidden="true" />{notice.audience_label}</span>
        <time dateTime={notice.published_at}>{formatTimestampDate(notice.published_at)}</time>
      </div>
      <h2>{notice.title}</h2>
      {notice.edited_at && <p className="notice-edited"><span className="pill pill--warn">Edited</span>Changed on {formatTimestampDate(notice.edited_at)}</p>}
      <p className="notice-body">{notice.body}</p>
    </article>
  );
}

/** Marks the notice read the first time it shows unread while online. */
function useReadOnOpen(notice: Notice | undefined) {
  const [markRead] = useMarkNoticeReadMutation();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const marked = useRef<number | null>(null);
  useEffect(() => {
    if (!notice?.unread || offline || marked.current === notice.id) return;
    marked.current = notice.id;
    markRead(notice.id).unwrap().catch(() => { marked.current = null; });
  }, [notice, offline, markRead]);
}

function Missing() {
  return (
    <div className="screen-card notice-missing" role="alert">
      <span className="icon-tile"><Bell size={20} aria-hidden="true" /></span>
      <p>This notice isn&apos;t available any more.</p>
      <Link to="/inbox?show=notices">Back to notices</Link>
    </div>
  );
}
