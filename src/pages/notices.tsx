import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
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

/**
 * The notices the school has posted to the pupil: school-wide, their branch,
 * level or class.
 *
 * From `lg` the list and the open notice sit side by side, the newest open when
 * none is chosen. Below it they are two screens: the list, and a notice with a
 * way back. Opening a notice does not mark it read; the pupil does, as the
 * design has them, or marks them all at once. A notice corrected after it was
 * posted says so. Marking needs a connection.
 */
export function NoticesPage() {
  const { id } = useParams();
  const openId = id ? Number(id) : null;
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
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      <div className={cn(openId !== null && "hidden lg:block")}>
        <PageHeader
          title="Notices"
          description={unread ? `${unread} unread` : "All read"}
          actions={
            unread > 0 && (
              <Button variant="outline" size="sm" onClick={readAll} disabled={markingAll || offline}>
                Mark all as read
              </Button>
            )
          }
        />
      </div>

      {isLoading && <div className="h-40 animate-pulse rounded-xl bg-muted" />}
      {isError && !first && (
        <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          Notices can&apos;t be shown right now.{" "}
          <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      {first && first.notices.length === 0 && (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          Your school hasn&apos;t posted any notices to you yet.
        </p>
      )}

      {first && first.notices.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className={cn("min-w-0", openId !== null && "hidden lg:block")}>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {Array.from({ length: pages }, (_, i) => (
                <NoticeRows key={i + 1} page={i + 1} shownId={shownId} />
              ))}
            </ul>
            <MoreButton pages={pages} onMore={() => setPages((n) => n + 1)} />
          </div>
          <div className={cn("min-w-0", openId === null && "hidden lg:block")}>
            {shownId !== null && <NoticeDetail id={shownId} />}
          </div>
        </div>
      )}
    </PageShell>
  );
}

function NoticeRows({ page, shownId }: { page: number; shownId: number | null }) {
  const { data } = useNoticesQuery(page);
  return (
    <>
      {data?.notices.map((notice) => (
        <li key={notice.id}>
          <Link
            to={`/notices/${notice.id}`}
            className={cn(
              "flex min-w-0 items-start gap-3 px-4 py-3 hover:bg-accent",
              notice.id === shownId && "lg:bg-primary/5",
            )}
          >
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", notice.unread ? "bg-primary" : "bg-transparent")}
              aria-label={notice.unread ? "Unread" : undefined}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("truncate text-sm text-foreground", notice.unread && "font-semibold")}>{notice.title}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{formatTimestampDate(notice.published_at)}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{notice.audience_label}</p>
            </div>
          </Link>
        </li>
      ))}
    </>
  );
}

/** "Show older notices" while the last page loaded has a next one. */
function MoreButton({ pages, onMore }: { pages: number; onMore: () => void }) {
  const { data } = useNoticesQuery(pages);
  if (!data?.next) return null;
  return (
    <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={onMore}>
      Show older notices
    </Button>
  );
}

function NoticeDetail({ id }: { id: number }) {
  const navigate = useNavigate();
  const { data: notice, isError } = useNoticeQuery(id);
  const [markRead, { isLoading }] = useMarkNoticeReadMutation();
  const offline = useAppSelector((s) => s.connectivity.offline);

  if (isError) {
    return (
      <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        This notice isn&apos;t available any more.{" "}
        <Link to="/notices" className="font-medium text-primary">
          Back to notices
        </Link>
      </div>
    );
  }
  if (!notice) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  const read = async () => {
    try {
      await markRead(notice.id).unwrap();
    } catch (error) {
      toast.error(refusal(error).message);
    }
  };

  return (
    <article className="min-w-0 rounded-xl border border-border p-4">
      <button
        type="button"
        onClick={() => navigate("/notices")}
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground lg:hidden"
      >
        <ArrowLeft className="size-4" /> Notices
      </button>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{meta(notice)}</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{notice.title}</h2>
        </div>
        {notice.unread ? (
          <Button variant="outline" size="sm" onClick={read} disabled={isLoading || offline}>
            <Check /> Mark as read
          </Button>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Read</span>
        )}
      </div>
      <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-foreground">{notice.body}</p>
    </article>
  );
}

function meta(notice: Notice): string {
  const parts = [notice.audience_label, formatTimestampDate(notice.published_at)];
  if (notice.edited_at) parts.push(`edited ${formatTimestampDate(notice.edited_at)}`);
  return parts.filter(Boolean).join(" · ");
}
