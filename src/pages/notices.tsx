import { useState } from "react";
import { ArrowLeft, Bell, Check, ChevronDown } from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/page-shell";
import { formatTimestampDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  refusal,
  useMarkAllNoticesReadMutation,
  useMarkNoticeReadMutation,
  useNoticeQuery,
  useNoticesQuery,
  type Notice,
} from "@/redux/services/portal-api";

import "./notices.css";

/** School notices stay unread when opened, until the pupil marks them read. */
export function NoticesPage() {
  const { id } = useParams();
  const requestedId = id ? Number(id) : null;
  const openId = requestedId && Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : null;
  const [pages, setPages] = useState(1);
  const { data: first, isLoading, isError, refetch } = useNoticesQuery(1);
  const [markAll, { isLoading: markingAll }] = useMarkAllNoticesReadMutation();
  const offline = useAppSelector((s) => s.connectivity.offline);
  const unread = first?.unreadCount ?? 0;
  const shownId = openId ?? first?.notices[0]?.id ?? null;

  const readAll = async () => {
    try {
      await markAll().unwrap();
      toast.success("All notices marked as read");
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <PageShell className="notices-page">
      <div className="notices-wrap">
        <header className={cn("notices-heading", openId !== null && "is-hidden-on-detail")}><p>School updates</p><h1>What&apos;s new from your school.</h1></header>
        {isLoading && !first && <div className="notices-loading" role="status" aria-label="Loading notices" />}
        {isError && !first && <div className="notices-error" role="alert">Notices can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></div>}
        {(first || openId !== null) && <div className="notices-layout">
          <div className={cn("notices-list-panel", openId !== null && "is-hidden-on-detail")}>
            <section className="notices-cover" aria-label="Notice summary">
              <div className="notices-cover-top"><span>School notices</span><span className="notices-cover-icon"><Bell size={21} aria-hidden="true" /></span></div>
              <h2>{unread > 0 ? `${unread} unread` : "All read"}</h2>
              <p>{unread > 0 ? "Updates waiting for you" : "You're up to date with school news"}</p>
              {unread > 0 && <button type="button" className="notices-mark-all" onClick={readAll} disabled={markingAll || offline}><Check size={17} aria-hidden="true" />{markingAll ? "Marking…" : "Mark all as read"}</button>}
            </section>
            <div className="notices-section-heading"><h2>Latest notices</h2><span>Newest first</span></div>
            {first?.notices.length === 0 ? <div className="notices-empty"><span className="notices-empty-icon"><Bell size={25} aria-hidden="true" /></span><h2>No notices yet</h2><p>Your school&apos;s updates will appear here when they are posted.</p></div> : <>
              <ul className="notices-list">{Array.from({ length: pages }, (_, index) => <NoticeRows key={index + 1} page={index + 1} shownId={shownId} />)}</ul>
              <MoreButton pages={pages} onMore={() => setPages((value) => value + 1)} />
            </>}
          </div>
          {shownId !== null && <div className={cn("notices-detail-panel", openId === null && "is-hidden-on-list")}>
            <Link to="/notices" className="notices-detail-back"><ArrowLeft size={17} aria-hidden="true" />All notices</Link>
            <NoticeDetail id={shownId} />
          </div>}
        </div>}
      </div>
    </PageShell>
  );
}

function NoticeRows({ page, shownId }: { page: number; shownId: number | null }) {
  const { data } = useNoticesQuery(page);
  return <>{data?.notices.map((notice) => <li key={notice.id} className={cn("notices-row", notice.unread && "is-unread", notice.id === shownId && "is-selected")}>
    <Link to={`/notices/${notice.id}`} aria-label={`Open ${notice.title}, ${notice.unread ? "unread" : "read"}`}>
      <span className="notices-row-icon"><Bell size={20} aria-hidden="true" /></span>
      <span className="notices-row-main">
        <span className="notices-row-top"><span>{notice.audience_label}</span><time>{formatTimestampDate(notice.published_at)}</time></span>
        <strong className="notices-row-title">{notice.title}</strong>
        <span className="notices-row-preview">{notice.body}</span>
        <span className="notices-row-flags"><Status unread={notice.unread} />{notice.edited_at && <span className="notices-flag is-edited">Edited</span>}</span>
      </span>
    </Link>
  </li>)}</>;
}

/** Show older pages only while the latest loaded page has another page. */
function MoreButton({ pages, onMore }: { pages: number; onMore: () => void }) {
  const { data } = useNoticesQuery(pages);
  if (!data?.next) return null;
  return <button type="button" className="notices-older" onClick={onMore}>Show older notices <ChevronDown size={16} aria-hidden="true" /></button>;
}

function NoticeDetail({ id }: { id: number }) {
  const { data: notice, isError } = useNoticeQuery(id);
  const [markRead, { isLoading }] = useMarkNoticeReadMutation();
  const offline = useAppSelector((s) => s.connectivity.offline);

  if (isError) return <div className="notices-detail-error" role="alert">This notice isn&apos;t available any more. <Link to="/notices">Back to notices</Link></div>;
  if (!notice) return <div className="notices-detail-loading" role="status" aria-label="Loading notice" />;

  const read = async () => {
    try {
      await markRead(notice.id).unwrap();
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return <article className="notices-detail-card">
      <div className="notices-detail-accent" />
      <div className="notices-detail-inner">
        <div className="notices-detail-kicker"><Bell size={17} aria-hidden="true" />School notice</div>
        <h2>{notice.title}</h2>
        <div className="notices-detail-flags"><Status unread={notice.unread} />{notice.edited_at && <span className="notices-flag is-edited">Edited</span>}</div>
        <dl className="notices-detail-meta">
          <div><dt>For</dt><dd>{notice.audience_label}</dd></div>
          <div><dt>Published</dt><dd>{formatTimestampDate(notice.published_at)}</dd></div>
          {notice.edited_at && <div><dt>Last edited</dt><dd>{formatTimestampDate(notice.edited_at)}</dd></div>}
        </dl>
        <p className="notices-detail-body">{notice.body}</p>
        <div className="notices-detail-bottom">{notice.unread ? <button type="button" className="notices-mark-read" onClick={read} disabled={isLoading || offline}><Check size={17} aria-hidden="true" />{isLoading ? "Marking…" : "Mark as read"}</button> : <span className="notices-read-confirmation"><Check size={17} aria-hidden="true" />You&apos;ve marked this notice as read</span>}</div>
      </div>
    </article>;
}

function Status({ unread }: Pick<Notice, "unread">) {
  return <span className={cn("notices-flag", unread && "is-unread")}>{unread ? "Unread" : "Read"}</span>;
}
