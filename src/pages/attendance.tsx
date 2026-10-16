import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { monthsOf } from "@/lib/attendance-months";
import { formatClock, formatDate } from "@/lib/format";
import { rateLine } from "@/lib/pupil-lines";
import { cn } from "@/lib/utils";
import { useAttendanceQuery, type AttendanceDay, type AttendanceNote } from "@/redux/services/portal-api";


/**
 * The pupil's attendance for a term: the rate and the counts, a calendar per
 * month, and the days worth a note (absent, late and excused, with the reason,
 * the register's note and the arrival time).
 *
 * The current term is shown first; earlier terms are a choice away. A term
 * with no register taken yet says so rather than showing 0%. A day the pupil
 * thinks is wrong is for their class teacher to correct, and the screen says
 * so.
 */
export function AttendancePage() {
  const [term, setTerm] = useState<number | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useAttendanceQuery(term);
  const counts = data?.counts;
  const taken = counts ? counts.present + counts.absent + counts.excused : 0;

  return (
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      <PageHeader
        title="My attendance"
        description={data?.term ? `${data.term.name} · ${data.term.session_name}` : ""}
        actions={
          data && data.terms.length > 1 && (
            <select
              aria-label="Term"
              value={data.term?.id ?? ""}
              onChange={(e) => setTerm(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-background px-2 text-base md:text-sm"
            >
              {[...data.terms].reverse().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.session_name}
                  {t.is_current ? " (this term)" : ""}
                </option>
              ))}
            </select>
          )
        }
      />
      {isLoading && <div className="h-48 animate-pulse rounded-xl bg-muted" />}
      {isError && !data && (
        <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          Your attendance can&apos;t be shown right now.{" "}
          <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      {data && counts && (
        <div className={cn("grid min-w-0 gap-4", isFetching && "opacity-60")}>
          <section className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border p-4">
            <div className="min-w-0">
              <p className="font-mono text-3xl font-semibold text-foreground">
                {counts.rate === null ? "-" : `${Math.round(counts.rate)}%`}
              </p>
              <p className="text-xs text-muted-foreground">present this term</p>
            </div>
            <div className="min-w-0 flex-1 basis-60 space-y-2">
              <p className="text-sm text-foreground">{rateLine(counts.rate)}</p>
              {taken > 0 && (
                <p className="text-xs text-muted-foreground">
                  From {taken} {taken === 1 ? "day" : "days"} with a register so far. If a day looks wrong, tell your
                  class teacher.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Count label="Present" value={counts.present} />
                <Count label="Late" value={counts.late} />
                <Count label="Absent" value={counts.absent} />
                <Count label="Excused" value={counts.excused} />
              </dl>
            </div>
          </section>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="min-w-0 rounded-xl border border-border p-4">
              <h2 className="mb-1 text-sm font-semibold text-foreground">Day by day</h2>
              <Legend />
              <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {monthsOf(data.days).map((month) => (
                  <MonthCalendar key={month.key} label={month.label} lead={month.lead} days={month.days} />
                ))}
              </div>
            </section>
            <section className="min-w-0 rounded-xl border border-border p-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Days to note</h2>
              {data.notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {taken > 0 ? "No absences or late days this term." : "Nothing yet this term."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.notes.map((note) => (
                    <NoteRow key={note.date} note={note} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-base font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** How a day looks, and what it is called, by its state and mark. */
const DAY_LOOK: Record<string, { label: string; className: string }> = {
  P: { label: "Present", className: "bg-green-100 text-green-800 font-semibold" },
  L: { label: "Late", className: "bg-amber-100 text-amber-800 font-semibold" },
  A: { label: "Absent", className: "bg-red-100 text-red-700 font-semibold" },
  E: { label: "Excused", className: "bg-sky-100 text-sky-800 font-semibold" },
  CLOSED: { label: "No school", className: "bg-transparent text-muted-foreground/50" },
  NOT_TAKEN: { label: "No register yet", className: "border border-dashed border-border text-muted-foreground" },
  SUSPENDED: { label: "Not on the register", className: "bg-muted text-muted-foreground" },
  NOT_ON_ROLL: { label: "Before you joined", className: "text-muted-foreground/40" },
};

function lookOf(day: AttendanceDay) {
  return DAY_LOOK[day.state === "MARKED" && day.mark ? day.mark : day.state] ?? DAY_LOOK.NOT_TAKEN;
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {(["P", "L", "A", "E", "NOT_TAKEN"] as const).map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className={cn("inline-block size-3 rounded-sm", DAY_LOOK[key].className)} />
          {DAY_LOOK[key].label}
        </li>
      ))}
    </ul>
  );
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function MonthCalendar({ label, lead, days }: { label: string; lead: number; days: (AttendanceDay | null)[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[10px] text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {days.map((day, i) => {
          if (!day) return <span key={i} className="flex aspect-square items-center justify-center text-[11px] text-muted-foreground/30">{i + 1}</span>;
          const look = lookOf(day);
          const title = `${formatDate(day.date)}: ${look.label}${day.closed_reason ? ` (${day.closed_reason})` : ""}`;
          return (
            <span
              key={i}
              title={title}
              aria-label={title}
              className={cn("flex aspect-square items-center justify-center rounded-md text-[11px]", look.className)}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function NoteRow({ note }: { note: AttendanceNote }) {
  const look = DAY_LOOK[note.mark];
  const detail = [
    note.reason_label,
    note.arrived_at ? `arrived ${formatClock(note.arrived_at)}` : null,
    note.note || null,
  ].filter(Boolean);
  return (
    <li className="flex min-w-0 items-start gap-3 py-2">
      <span className={cn("mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px]", look?.className)}>{note.mark_label}</span>
      <div className="min-w-0">
        <p className="text-sm text-foreground">{formatDate(note.date)}</p>
        {detail.length > 0 && <p className="text-xs break-words text-muted-foreground">{detail.join(" · ")}</p>}
      </div>
    </li>
  );
}
