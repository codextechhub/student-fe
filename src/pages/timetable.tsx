import { useState } from "react";
import { CalendarDays, Clock3, MapPin } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { formatClock } from "@/lib/format";
import { useTimetableQuery, type Timetable, type TimetableCell, type TodayPeriod } from "@/redux/services/portal-api";

import "./timetable.css";

/** A published school week: current lesson, one selected day's full list, and a desktop week summary. */
export function TimetablePage() {
  const { data, isLoading, isError, refetch } = useTimetableQuery();
  return (
    <PageShell className="timetable-page">
      <div className="timetable-wrap">
        <header className="timetable-heading">
          <h1>Your week, made simple</h1>
          {data?.class_name && <span>{data.class_name}</span>}
        </header>
        {isLoading && !data && <div className="timetable-loading" role="status" aria-label="Loading timetable" />}
        {isError && !data && (
          <div className="timetable-panel timetable-message" role="alert">
            Your timetable can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button>
          </div>
        )}
        {data && !data.published && (
          <div className="timetable-panel timetable-message">
            <CalendarDays size={25} aria-hidden="true" />
            <p>Your class timetable hasn&apos;t been published yet. It will appear here when the school publishes it.</p>
          </div>
        )}
        {data?.published && (
          <div className="timetable-layout">
            <CurrentLesson timetable={data} />
            <DaySchedule timetable={data} />
            <WeekSummary timetable={data} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function cellTitle(cell: TimetableCell | TodayPeriod): string {
  return cell.kind === "BREAK" ? cell.label || "Break" : cell.subject || "Free period";
}

function cellMeta(cell: TimetableCell): string {
  return cell.kind === "BREAK" ? "Break" : [cell.teacher, cell.room].filter(Boolean).join(" · ") || "Class period";
}

function CurrentLesson({ timetable }: { timetable: Timetable }) {
  const periods = timetable.today?.periods ?? [];
  const now = periods.find((period) => period.state === "now" && period.kind !== "BREAK");
  const next = periods.find((period) => period.state === "next" && period.kind !== "BREAK");
  const featured = now ?? next;
  const nextAfterNow = now ? next : undefined;
  const title = featured ? cellTitle(featured) : timetable.today ? "All done for today" : "Plan your week";
  const label = now ? "Happening now" : next ? "Up next" : "Your timetable";

  return (
    <section className="timetable-feature" aria-labelledby="timetable-feature-title">
      <div className="timetable-feature-orb" aria-hidden="true" />
      <p className="timetable-feature-label">{label}</p>
      <h2 id="timetable-feature-title">{title}</h2>
      <p className="timetable-feature-description">
        {featured
          ? `${formatClock(featured.start_time)}–${formatClock(featured.end_time)}${featured.teacher ? ` · ${featured.teacher}` : ""}`
          : timetable.today ? "Your classes have finished. Take a look at the rest of your week." : "Choose a school day to see its classes."}
      </p>
      {featured && (
        <div className="timetable-feature-chips">
          {featured.room && <span className="timetable-glass-chip"><MapPin size={14} aria-hidden="true" />{featured.room}</span>}
          {nextAfterNow && <span className="timetable-glass-chip"><Clock3 size={14} aria-hidden="true" />Next: {cellTitle(nextAfterNow)} · {formatClock(nextAfterNow.start_time)}</span>}
        </div>
      )}
    </section>
  );
}

function DaySchedule({ timetable }: { timetable: Timetable }) {
  const todayIndex = timetable.days.findIndex((day) => day.is_today);
  const [chosen, setChosen] = useState(() => Math.max(0, todayIndex));
  const selected = Math.min(chosen, timetable.days.length - 1);
  const day = timetable.days[selected];
  const todayStates = timetable.today?.periods ?? [];

  return (
    <section className="timetable-panel timetable-day-panel" aria-labelledby="timetable-week-title">
      <div className="timetable-panel-heading"><h2 id="timetable-week-title">This week</h2><span>{timetable.class_name}</span></div>
      {timetable.days.length > 0 ? (
        <>
          <div className="timetable-day-strip" role="group" aria-label="Choose a school day">
            {timetable.days.map((item, index) => (
              <button
                key={item.day_of_week}
                type="button"
                className={`timetable-day-button${selected === index ? " is-selected" : ""}`}
                aria-pressed={selected === index}
                onClick={() => setChosen(index)}
              >
                <span>{item.day_label.slice(0, 3)}</span>
                <strong>{item.is_today ? "Today" : item.day_label.slice(0, 3)}</strong>
              </button>
            ))}
          </div>
          <div className="timetable-day-heading"><h3>{day.day_label}&apos;s classes</h3><span>{day.cells.length} {day.cells.length === 1 ? "period" : "periods"}</span></div>
          {day.cells.length ? (
            <ol className="timetable-lessons">
              {day.cells.map((cell) => {
                const state = day.is_today ? todayStates.find((period) => period.start_time === cell.start_time && period.kind === cell.kind)?.state : undefined;
                return (
                  <li key={`${cell.start_time}-${cell.label}`} className={`timetable-lesson${state === "now" ? " is-now" : ""}${cell.kind === "BREAK" ? " is-break" : ""}`}>
                    <span className="timetable-lesson-time"><span>{formatClock(cell.start_time)}</span><span>{formatClock(cell.end_time)}</span></span>
                    <span className="timetable-lesson-track" aria-hidden="true" />
                    <span className="timetable-lesson-detail"><strong>{cellTitle(cell)}</strong><span>{cellMeta(cell)}</span></span>
                    {(state === "now" || state === "next") && <span className={`timetable-lesson-badge is-${state}`}>{state === "now" ? "Now" : "Next"}</span>}
                  </li>
                );
              })}
            </ol>
          ) : <p className="timetable-empty">No classes on {day.day_label}.</p>}
        </>
      ) : <p className="timetable-empty">No school days are in this timetable yet.</p>}
    </section>
  );
}

function WeekSummary({ timetable }: { timetable: Timetable }) {
  if (timetable.days.length === 0) return null;
  return (
    <section className="timetable-panel timetable-summary" aria-labelledby="timetable-summary-title">
      <div className="timetable-panel-heading"><h2 id="timetable-summary-title">Week at a glance</h2><span>Choose a day above for the full list</span></div>
      <div className="timetable-summary-grid">
        {timetable.days.map((day) => (
          <div key={day.day_of_week} className={`timetable-summary-day${day.is_today ? " is-today" : ""}`}>
            <strong>{day.day_label}{day.is_today ? " · Today" : ""}</strong>
            {day.cells.filter((cell) => cell.kind !== "BREAK").length ? (
              <ul>{day.cells.filter((cell) => cell.kind !== "BREAK").slice(0, 3).map((cell) => <li key={`${cell.start_time}-${cell.label}`}>{cellTitle(cell)}</li>)}</ul>
            ) : <span>No classes</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
