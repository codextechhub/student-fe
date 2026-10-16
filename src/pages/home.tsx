import type { ReactNode } from "react";
import { Link } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { PupilAvatar } from "@/components/pupil-avatar";
import { PushOffer } from "@/components/push-settings";
import { TodayPeriods } from "@/components/today-periods";
import { formatDate, formatLongDate, formatNaira, formatTimestampDate } from "@/lib/format";
import { classLine, rateLine, todayLine } from "@/lib/pupil-lines";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { noticeCleared } from "@/redux/features/session-slice";
import {
  useHomeQuery,
  useMeQuery,
  type Home,
  type Unavailable,
} from "@/redux/services/portal-api";

/**
 * The pupil's home: who they are, today's classes, today's attendance and the
 * term's rate, the fee balance, and the newest notice.
 *
 * Every block is read in one call and arrives with `available`; a block the
 * school could not read shows the sentence it sent, never a zero, and the rest
 * still show. Messages and assignments are not built, so their blocks are not
 * drawn. Links appear only to screens that exist. A pupil not yet asked about
 * notifications is offered them here, once.
 */
export function HomePage() {
  const dispatch = useAppDispatch();
  const notice = useAppSelector((s) => s.session.notice);
  const { data: me } = useMeQuery();
  const { data: home, isLoading, isError, refetch } = useHomeQuery();

  return (
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" className="font-medium" onClick={() => dispatch(noticeCleared())}>
            Dismiss
          </button>
        </div>
      )}

      {me && (
        <section className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-4">
          <PupilAvatar name={me.student.full_name} photo={me.student.photo_url} size={48} />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground">Hi, {me.student.first_name}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {[classLine(me), home ? formatLongDate(home.date) : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
        </section>
      )}

      <PushOffer />

      {isLoading && <div className="h-48 animate-pulse rounded-xl bg-muted" />}
      {isError && !home && (
        <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          Your home screen can&apos;t be shown right now.{" "}
          <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}

      {home && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <TodayCard block={home.today} />
          <div className="grid min-w-0 content-start gap-4">
            <AttendanceCard block={home.attendance} />
            <FeesCard block={home.fees} />
            <LatestNoticeCard block={home.notices} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border p-4", className)}>
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function UnavailableLine({ block }: { block: Unavailable }) {
  return <p className="text-xs text-muted-foreground">{block.message}</p>;
}

function TodayCard({ block }: { block: Home["today"] }) {
  if (!block.available) {
    return (
      <Card title="Today's classes">
        <UnavailableLine block={block} />
      </Card>
    );
  }
  return (
    <Card title="Today's classes">
      {block.published ? (
        <TodayPeriods periods={block.periods} />
      ) : (
        <p className="text-xs text-muted-foreground">Your class timetable hasn&apos;t been published yet.</p>
      )}
      {block.published && block.periods.length > 0 && (
        <Link to="/timetable" className="mt-3 inline-block text-xs font-medium text-primary">
          Full timetable
        </Link>
      )}
    </Card>
  );
}

function AttendanceCard({ block }: { block: Home["attendance"] }) {
  return (
    <Card title="Attendance">
      {!block.available ? (
        <UnavailableLine block={block} />
      ) : (
        <div className="space-y-1">
          {todayLine(block.today) && <p className="text-sm text-foreground">{todayLine(block.today)}</p>}
          <p className="text-xs text-muted-foreground">{rateLine(block.rate)}</p>
          <Link to="/attendance" className="inline-block pt-2 text-xs font-medium text-primary">
            Day by day
          </Link>
        </div>
      )}
    </Card>
  );
}

const FEE_CHIP: Record<string, { label: string; className: string }> = {
  OWING: { label: "Owing", className: "bg-amber-100 text-amber-800" },
  CLEAR: { label: "Paid up", className: "bg-green-100 text-green-800" },
  IN_CREDIT: { label: "In credit", className: "bg-green-100 text-green-800" },
};

function FeesCard({ block }: { block: Home["fees"] }) {
  if (!block.available) {
    return (
      <Card title="Fee balance">
        <UnavailableLine block={block} />
      </Card>
    );
  }
  const chip = FEE_CHIP[block.status];
  const invoice = block.open_invoice;
  return (
    <Card title="Fee balance">
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate font-mono text-lg font-semibold text-foreground">
          {formatNaira(Math.abs(block.balance))}
        </p>
        {chip && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", chip.className)}>{chip.label}</span>}
      </div>
      {invoice && (
        <p className="mt-1 text-xs text-muted-foreground">
          {[invoice.title, invoice.due_date ? `due ${formatDate(invoice.due_date)}` : ""].filter(Boolean).join(" · ")}
          {block.open_invoice_count > 1 && ` and ${block.open_invoice_count - 1} more`}
        </p>
      )}
      <Link to="/fees" className="inline-block pt-2 text-xs font-medium text-primary">
        View fees
      </Link>
    </Card>
  );
}

function LatestNoticeCard({ block }: { block: Home["notices"] }) {
  if (!block.available) {
    return (
      <Card title="Latest notice">
        <UnavailableLine block={block} />
      </Card>
    );
  }
  const latest = block.latest;
  if (!latest) {
    return (
      <Card title="Latest notice">
        <p className="text-xs text-muted-foreground">No notices yet.</p>
      </Card>
    );
  }
  return (
    <Link
      to={`/notices/${latest.id}`}
      className="block min-w-0 rounded-xl border border-border p-4 hover:bg-accent"
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Latest notice</span>
        <span className="shrink-0">{formatTimestampDate(latest.published_at)}</span>
      </div>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        {latest.unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        <span className="truncate">{latest.title}</span>
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{latest.body}</p>
    </Link>
  );
}
