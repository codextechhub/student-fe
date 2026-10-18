import { Bell, CheckCircle2, ChevronRight, Wallet } from "lucide-react";
import { Link } from "react-router";

import { InstallOffer } from "@/components/install-offer";
import { PageShell } from "@/components/layout/page-shell";
import { PushOffer } from "@/components/push-settings";
import { formatClock, formatDate, formatLongDate, formatNaira, formatTimestampDate } from "@/lib/format";
import { classLine, rateLine, todayLine } from "@/lib/pupil-lines";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { noticeCleared } from "@/redux/features/session-slice";
import {
  useHomeQuery,
  useMeQuery,
  type Home,
  type TodayPeriod,
  type Unavailable,
} from "@/redux/services/portal-api";

import "./home.css";

/** The home design uses the existing per-pupil reads and keeps each block's unavailable state. */
export function HomePage() {
  const dispatch = useAppDispatch();
  const notice = useAppSelector((s) => s.session.notice);
  const { data: me } = useMeQuery();
  const { data: home, isLoading, isError, refetch } = useHomeQuery();
  const className = me ? classLine(me) : "";
  const schoolYear = [me?.term?.name, me?.session?.name].filter(Boolean).join(" · ");

  return (
    <PageShell className="home-page">
      <div className="home-layout">
        {notice && (
          <div role="status" className="home-session-notice">
            <span>{notice}</span>
            <button type="button" onClick={() => dispatch(noticeCleared())}>Dismiss</button>
          </div>
        )}

        <div className="home-side">
          <section className="home-hero" aria-labelledby="home-welcome">
            <div className="home-hero-orb" aria-hidden="true" />
            <p className="home-hero-date">{home ? formatLongDate(home.date) : "Today"}</p>
            <h1 id="home-welcome">Hello, {me?.student.first_name || "there"}.</h1>
            {(className || schoolYear) && (
              <div className="home-hero-chips">
                {className && <span className="home-glass-chip">{className}</span>}
                {schoolYear && <span className="home-glass-chip">{schoolYear}</span>}
              </div>
            )}
          </section>
          <InstallOffer />
        </div>
        <div className="home-content">
          {isLoading && !home && <div className="home-loading" role="status" aria-label="Loading home" />}
          {isError && !home && (
            <div className="home-surface home-error" role="alert">
              Your home screen can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button>
            </div>
          )}
          {home && (
            <>
              <TodaySection block={home.today} />
              <section aria-labelledby="home-overview-title">
                <SectionHeading title="Your overview" subtitle="The things that matter today" id="home-overview-title" />
                <div className="home-insights">
                  <AttendanceCard block={home.attendance} />
                  <FeesCard block={home.fees} />
                </div>
              </section>
              <NoticeSection block={home.notices} />
            </>
          )}
          <PushOffer />
        </div>
      </div>
    </PageShell>
  );
}

function SectionHeading({ title, subtitle, id, href, linkLabel }: { title: string; subtitle: string; id: string; href?: string; linkLabel?: string }) {
  return (
    <div className="home-section-heading">
      <div><h2 id={id}>{title}</h2><p>{subtitle}</p></div>
      {href && linkLabel && <Link to={href} className="home-section-link">{linkLabel}<ChevronRight size={15} aria-hidden="true" /></Link>}
    </div>
  );
}

function UnavailableLine({ block }: { block: Unavailable }) {
  return <p className="home-empty">{block.message}</p>;
}

function shownPeriods(periods: TodayPeriod[]): TodayPeriod[] {
  const remaining = periods.filter((period) => period.state !== "done");
  return remaining.length ? remaining.slice(0, 3) : periods.slice(-3);
}

function TodaySection({ block }: { block: Home["today"] }) {
  const hasPeriods = block.available && block.published && block.periods.length > 0;
  return (
    <section aria-labelledby="home-today-title">
      <SectionHeading title="Today's classes" subtitle="Your schedule, at a glance" id="home-today-title" href={hasPeriods ? "/timetable" : undefined} linkLabel="View all" />
      <div className="home-surface home-schedule">
        {!block.available ? <UnavailableLine block={block} /> : !block.published ? (
          <p className="home-empty">Your class timetable hasn&apos;t been published yet.</p>
        ) : !hasPeriods ? (
          <p className="home-empty">No classes today.</p>
        ) : (
          <ol>
            {shownPeriods(block.periods).map((period) => (
              <li key={`${period.start_time}-${period.label}`} className={`home-period home-period--${period.state}`}>
                <div className="home-period-time"><span>{formatClock(period.start_time)}</span><span>{formatClock(period.end_time)}</span></div>
                <span className="home-period-line" aria-hidden="true" />
                <div className="home-period-detail">
                  <strong>{period.kind === "BREAK" ? period.label : period.subject || "Free period"}</strong>
                  <span>{period.kind === "BREAK" ? "Break" : [period.teacher, period.room].filter(Boolean).join(" · ") || "Class period"}</span>
                </div>
                {(period.state === "now" || period.state === "next") && <span className={`home-period-badge home-period-badge--${period.state}`}>{period.state === "now" ? "Now" : "Next"}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function AttendanceCard({ block }: { block: Home["attendance"] }) {
  const detail = block.available ? todayLine(block.today) || rateLine(block.rate) : block.message;
  const value = block.available && block.rate !== null ? `${Math.round(block.rate)}%` : "—";
  return (
    <Link to="/attendance" className="home-surface home-insight home-insight--attendance" aria-label={`Attendance. ${value}. ${detail}`}>
      <span className="home-insight-icon"><CheckCircle2 size={19} aria-hidden="true" /></span><ChevronRight className="home-insight-arrow" size={17} aria-hidden="true" />
      <span className="home-insight-label">Attendance</span>
      <strong className="home-insight-value">{value}</strong>
      <span className="home-insight-sub">{detail}</span>
    </Link>
  );
}

const FEE_STATUS: Record<"OWING" | "CLEAR" | "IN_CREDIT", string> = {
  OWING: "Owing", CLEAR: "Paid up", IN_CREDIT: "In credit",
};

function FeesCard({ block }: { block: Home["fees"] }) {
  const detail = !block.available ? block.message : [
    FEE_STATUS[block.status],
    block.open_invoice?.due_date ? `Due ${formatDate(block.open_invoice.due_date)}` : "",
    block.open_invoice_count > 1 ? `${block.open_invoice_count} open bills` : "",
  ].filter(Boolean).join(" · ");
  return (
    <Link to="/fees" className="home-surface home-insight home-insight--fees" aria-label={`Fee balance. ${block.available ? `${formatNaira(Math.abs(block.balance))}. ` : ""}${detail}`}>
      <span className="home-insight-icon"><Wallet size={19} aria-hidden="true" /></span><ChevronRight className="home-insight-arrow" size={17} aria-hidden="true" />
      <span className="home-insight-label">Fee balance</span>
      <strong className="home-insight-value">{block.available ? formatNaira(Math.abs(block.balance)) : "—"}</strong>
      <span className="home-insight-sub">{detail}</span>
    </Link>
  );
}

function NoticeSection({ block }: { block: Home["notices"] }) {
  const latest = block.available ? block.latest : null;
  return (
    <section aria-labelledby="home-notice-title">
      <SectionHeading title="From your school" subtitle="Latest announcement" id="home-notice-title" href={block.available ? "/notices" : undefined} linkLabel="See all" />
      {!block.available ? <div className="home-surface home-notice"><UnavailableLine block={block} /></div> : !latest ? (
        <div className="home-surface home-notice"><p className="home-empty">No notices yet.</p></div>
      ) : (
        <Link to={`/notices/${latest.id}`} className="home-surface home-notice home-notice-link">
          <span className="home-notice-icon"><Bell size={19} aria-hidden="true" /></span>
          <span className="home-notice-body">
            <span className="home-notice-top"><strong>{latest.unread && <span className="home-unread-dot" aria-label="Unread" />}{latest.title}</strong><time dateTime={latest.published_at}>{formatTimestampDate(latest.published_at)}</time></span>
            <span className="home-notice-excerpt">{latest.body}</span>
          </span>
        </Link>
      )}
    </section>
  );
}
