import { useEffect, useState } from "react";
import { Bell, CheckCircle2, ChevronRight, Clock3, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router";

import { InstallOffer } from "@/components/install-offer";
import { PaymentNotices } from "@/components/payment-notices";
import { PageShell } from "@/components/layout/page-shell";
import { ScreenTitle } from "@/components/layout/screen";
import { PushOffer } from "@/components/push-settings";
import { feeFigures } from "@/lib/fee-figures";
import { formatClock, formatDate, formatLongDate, formatNaira, formatRowWhen } from "@/lib/format";
import { classLine, rateLine, todayLine } from "@/lib/pupil-lines";
import { periodProgress, todayPlan } from "@/lib/today";
import { useSubjectColours } from "@/lib/use-subject-colours";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { noticeCleared } from "@/redux/features/session-slice";
import {
  useHomeQuery,
  useMarkNoticeReadMutation,
  useMeQuery,
  type Home,
  type TodayPeriod,
  type Unavailable,
} from "@/redux/services/portal-api";

import "./home.css";

/**
 * Home (design 2b): the greeting as the screen's large title, the lesson
 * under way in the blue card with the rest of the day under it, attendance
 * and fees side by side, then payments and the school's latest notice.
 * Every block keeps its own unavailable state, from the one `home/` read.
 * From 900px the day sits on the left and the rest on the right.
 */
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

        <div className="home-day">
          <ScreenTitle eyebrow={home ? formatLongDate(home.date) : "Today"} title={`Hello, ${me?.student.first_name || "there"}.`}>
            {(className || schoolYear) && (
              <div className="chips">
                {className && <span className="chip chip--brand">{className}</span>}
                {schoolYear && <span className="chip">{schoolYear}</span>}
              </div>
            )}
          </ScreenTitle>
          {isLoading && !home && <div className="home-loading" role="status" aria-label="Loading home" />}
          {isError && !home && (
            <div className="screen-card home-error" role="alert">
              Your home screen can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button>
            </div>
          )}
          {home && <Today block={home.today} />}
        </div>

        <div className="home-rest">
          {home && (
            <>
              <div className="home-insights">
                <AttendanceCard block={home.attendance} />
                <FeesCard block={home.fees} />
              </div>
              <PaymentNotices />
              <NoticeSection block={home.notices} />
            </>
          )}
          <div className="home-offers">
            <InstallOffer />
            <PushOffer />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/** The clock, read again every half minute, for the time left in a lesson. */
function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const nameOf = (period: TodayPeriod) => (period.kind === "BREAK" ? period.label : period.subject || "Free period");

/** Today's school day: the blue card and Later today, or a line saying why there is none. */
function Today({ block }: { block: Home["today"] }) {
  const periods = block.available && block.published ? block.periods : [];
  const plan = todayPlan(periods);
  const colours = useSubjectColours();
  const message = !block.available
    ? block.message
    : !block.published
      ? "Your class timetable hasn't been published yet."
      : periods.length === 0
        ? "No classes today."
        : !plan.card
          ? "That's all your classes for today."
          : "";
  return (
    <>
      {plan.card && <LessonCard period={plan.card} live={plan.cardIs === "now"} after={plan.after} />}
      {(message || plan.later.length > 0) && (
        <section className="screen-card home-later" aria-labelledby="home-later-title">
          <div className="home-later-head">
            <h2 id="home-later-title">{plan.card ? "Later today" : "Today"}</h2>
            {periods.length > 0 && <Link to="/timetable" className="screen-section-link">Timetable<ChevronRight size={15} aria-hidden="true" /></Link>}
          </div>
          {message ? <p className="home-empty">{message}</p> : (
            <ol>
              {plan.later.map((period) => (
                <li key={`${period.start_time}-${period.label}`}>
                  <span className="home-later-time">{formatClock(period.start_time)}</span>
                  <span className="home-later-dot" style={{ background: period.kind === "BREAK" ? "#cfd6e2" : colours.dot(nameOf(period)) }} aria-hidden="true" />
                  <strong>{nameOf(period)}</strong>
                  {period.room && <span className="home-later-room">{period.room}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

/**
 * The blue card: the lesson under way, how far through it the clock is and
 * what follows, or before school the lesson that is next.
 */
function LessonCard({ period, live, after }: { period: TodayPeriod; live: boolean; after: TodayPeriod | null }) {
  const now = useClock();
  const progress = live ? periodProgress(period, now) : null;
  const start = formatClock(period.start_time);
  return (
    <section className="home-now" aria-labelledby="home-now-title">
      <div className="screen-orb" aria-hidden="true" />
      <div className="home-now-top">
        <span className="home-now-label">
          {live ? <span className="live-dot" aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}
          {live ? "Happening now" : "Up next"}
        </span>
        {period.room && <span className="home-now-room"><MapPin size={13} aria-hidden="true" />{period.room}</span>}
      </div>
      <h2 id="home-now-title">{nameOf(period)}</h2>
      <p className="home-now-line">{[`${start} – ${formatClock(period.end_time)}`, period.kind === "BREAK" ? "" : period.teacher].filter(Boolean).join(" · ")}</p>
      {progress && (
        <>
          <div className="home-now-bar" role="progressbar" aria-label="Lesson time gone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.done * 100)}>
            <div style={{ width: `${Math.round(progress.done * 100)}%` }} />
          </div>
          <div className="home-now-times"><span>Started {start}</span><strong>{progress.minutesLeft} min left</strong></div>
        </>
      )}
      {after && (
        <div className="home-now-after">
          <span>Up next</span>
          <strong>{nameOf(after)}</strong>
          <span className="home-now-after-time">{formatClock(after.start_time)}</span>
        </div>
      )}
    </section>
  );
}

function AttendanceCard({ block }: { block: Home["attendance"] }) {
  const detail = block.available ? todayLine(block.today) || rateLine(block.rate) : block.message;
  const value = block.available && block.rate !== null ? `${Math.round(block.rate)}%` : "—";
  return (
    <Link to="/attendance" className="screen-card home-insight home-insight--attendance" aria-label={`Attendance. ${value}. ${detail}`}>
      <span className="home-insight-top"><span className="icon-tile icon-tile--good"><CheckCircle2 size={19} aria-hidden="true" /></span><ChevronRight size={16} aria-hidden="true" /></span>
      <span className="home-insight-label">Attendance</span>
      <strong className="home-insight-value">{value}</strong>
      <span className="home-insight-sub">{detail}</span>
    </Link>
  );
}

const FEE_STATUS: Record<"OWING" | "CLEAR" | "IN_CREDIT", string> = {
  OWING: "Owing", CLEAR: "Paid up", IN_CREDIT: "In credit",
};

export function FeesCard({ block }: { block: Home["fees"] }) {
  const { owing, credit } = block.available ? feeFigures(block) : { owing: 0, credit: 0 };
  const figure = block.available ? formatNaira(block.status === "IN_CREDIT" ? credit : owing) : "";
  const detail = !block.available ? block.message : [
    FEE_STATUS[block.status],
    block.open_invoice?.due_date ? `Due ${formatDate(block.open_invoice.due_date)}` : "",
    block.open_invoice_count > 1 ? `${block.open_invoice_count} open bills` : "",
  ].filter(Boolean).join(" · ");
  const creditLine = block.available && block.status === "OWING" && credit > 0 ? `${formatNaira(credit)} credit held by the school` : "";
  const settled = block.available && block.status !== "OWING";
  return (
    <Link to="/fees" className={`screen-card home-insight home-insight--fees${settled ? " is-settled" : ""}`} aria-label={`Fee balance. ${block.available ? `${figure}. ` : ""}${detail}${creditLine ? `. ${creditLine}` : ""}`}>
      <span className="home-insight-top"><span className="icon-tile icon-tile--warn"><Wallet size={19} aria-hidden="true" /></span><ChevronRight size={16} aria-hidden="true" /></span>
      <span className="home-insight-label">Fee balance</span>
      <strong className="home-insight-value">{block.available ? figure : "-"}</strong>
      <span className="home-insight-sub">{detail}</span>
      {creditLine && <span className="home-insight-sub home-insight-credit">{creditLine}</span>}
    </Link>
  );
}

/** The school's latest notice. It reads as it opens, as it does from the Inbox. */
function NoticeSection({ block }: { block: Home["notices"] }) {
  const latest = block.available ? block.latest : null;
  const [markRead] = useMarkNoticeReadMutation();
  const offline = useAppSelector((s) => s.connectivity.offline);
  return (
    <section className="home-notices" aria-labelledby="home-notice-title">
      <div className="screen-section">
        <h2 id="home-notice-title">From your school</h2>
        {block.available && <Link to="/inbox?show=notices" className="screen-section-link">See all</Link>}
      </div>
      {!block.available ? <div className="screen-card home-notice"><UnavailableLine block={block} /></div> : !latest ? (
        <div className="screen-card home-notice"><p className="home-empty">No notices yet.</p></div>
      ) : (
        <Link
          to={`/notices/${latest.id}`}
          className="screen-card home-notice"
          onClick={() => { if (latest.unread && !offline) markRead(latest.id).unwrap().catch(() => {}); }}
        >
          <span className="icon-tile home-notice-icon"><Bell size={19} aria-hidden="true" /></span>
          <span className="home-notice-body">
            <span className="home-notice-top">
              <strong>{latest.unread && <span className="home-unread-dot" aria-label="Unread" />}{latest.title}</strong>
              <time dateTime={latest.published_at}>{formatRowWhen(latest.published_at)}</time>
            </span>
            <span className="home-notice-excerpt">{latest.body}</span>
          </span>
        </Link>
      )}
    </section>
  );
}

function UnavailableLine({ block }: { block: Unavailable }) {
  return <p className="home-empty">{block.message}</p>;
}
