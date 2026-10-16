import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { nextLine, TodayPeriods } from "@/components/today-periods";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { formatClock, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTimetableQuery, type Timetable, type TimetableCell } from "@/redux/services/portal-api";

/**
 * The pupil's class timetable for the year.
 *
 * Today's periods first, with what is under way and what is next, then the
 * week: on a phone one day at a time behind day tabs (today chosen), from `md`
 * the whole week as a grid with today's column picked out. Only a published
 * timetable is shown; while the school has not published one, or is editing a
 * published one, the screen says so rather than showing a draft.
 */
export function TimetablePage() {
  const { data, isLoading, isError, refetch } = useTimetableQuery();

  return (
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      <PageHeader title="My timetable" description={data?.class_name || ""} />
      {isLoading && <div className="h-48 animate-pulse rounded-xl bg-muted" />}
      {isError && !data && (
        <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          Your timetable can&apos;t be shown right now.{" "}
          <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      {data && !data.published && (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          Your class timetable hasn&apos;t been published yet. It will appear here when the school publishes it.
        </p>
      )}
      {data?.published && (
        <>
          {data.today && (
            <section className="min-w-0 rounded-xl border border-border p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-sm font-semibold text-foreground">Today · {formatLongDate(data.today.date)}</h2>
                {nextLine(data.today.periods) && (
                  <span className="text-xs font-medium text-primary">{nextLine(data.today.periods)}</span>
                )}
              </div>
              <TodayPeriods periods={data.today.periods} />
            </section>
          )}
          <section className="min-w-0 rounded-xl border border-border p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">This week · {data.class_name}</h2>
            <div className="md:hidden">
              <DayTabs timetable={data} />
            </div>
            <div className="hidden md:block">
              <WeekGrid timetable={data} />
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}

function cellTitle(cell: TimetableCell): string {
  if (cell.kind === "BREAK") return cell.label || "Break";
  return cell.subject || "Free period";
}

function cellMeta(cell: TimetableCell): string {
  if (cell.kind === "BREAK") return "";
  return [cell.teacher, cell.room].filter(Boolean).join(" · ");
}

/** A phone's week: one day at a time, today chosen to begin with. */
function DayTabs({ timetable }: { timetable: Timetable }) {
  const todayIndex = Math.max(0, timetable.days.findIndex((d) => d.is_today));
  const [chosen, setChosen] = useState(todayIndex);
  const day = timetable.days[chosen];
  return (
    <div className="space-y-3">
      <div role="tablist" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {timetable.days.map((d, i) => (
          <button
            key={d.day_of_week}
            role="tab"
            type="button"
            aria-selected={i === chosen}
            onClick={() => setChosen(i)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium",
              i === chosen ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {d.day_label.slice(0, 3)}
            {d.is_today && <span className="sr-only"> (today)</span>}
          </button>
        ))}
      </div>
      {day && day.cells.length === 0 && <p className="text-xs text-muted-foreground">No classes on {day.day_label}.</p>}
      <ol className="space-y-1">
        {day?.cells.map((cell) => (
          <li
            key={`${cell.start_time}-${cell.label}`}
            className={cn("flex min-w-0 items-center gap-3 rounded-lg px-2 py-2", cell.kind === "BREAK" && "bg-muted/60")}
          >
            <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{formatClock(cell.start_time)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{cellTitle(cell)}</p>
              {cellMeta(cell) && <p className="truncate text-xs text-muted-foreground">{cellMeta(cell)}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The week as a grid: one row per period start time, one column per day.
 *
 * Rows come from every day's periods together, so a day with fewer periods
 * leaves its later cells empty rather than shifting. A row that is a break on
 * every day becomes one band across the week.
 */
function WeekGrid({ timetable }: { timetable: Timetable }) {
  const starts = [...new Set(timetable.days.flatMap((d) => d.cells.map((c) => c.start_time)))].sort();
  const cellAt = (dayIndex: number, start: string) =>
    timetable.days[dayIndex].cells.find((c) => c.start_time === start);

  return (
    <ScrollArea className="w-full">
      <div
        className="grid min-w-[640px] gap-1"
        style={{ gridTemplateColumns: `4.5rem repeat(${timetable.days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {timetable.days.map((d) => (
          <div
            key={d.day_of_week}
            className={cn("px-2 pb-1 text-xs font-medium", d.is_today ? "text-primary" : "text-foreground")}
          >
            {d.day_label}
            {d.is_today && <span className="ml-1 text-[11px] font-normal">· Today</span>}
          </div>
        ))}
        {starts.map((start) => {
          const row = timetable.days.map((_, i) => cellAt(i, start));
          const first = row.find(Boolean);
          const allBreak = row.every((c) => c?.kind === "BREAK");
          return (
            <div key={start} className="contents">
              <div className="px-1 py-2 text-xs text-muted-foreground tabular-nums">
                {formatClock(start)}
                {first && <span className="block text-[11px]">{formatClock(first.end_time)}</span>}
              </div>
              {allBreak ? (
                <div
                  className="flex items-center rounded-md bg-muted/60 px-3 text-xs font-medium text-muted-foreground"
                  style={{ gridColumn: `span ${timetable.days.length}` }}
                >
                  {first?.label || "Break"}
                </div>
              ) : (
                row.map((cell, i) => (
                  <div
                    key={i}
                    className={cn(
                      "min-w-0 rounded-md px-2 py-2",
                      timetable.days[i].is_today ? "bg-primary/10" : "bg-muted/40",
                      !cell && "bg-transparent",
                    )}
                  >
                    {cell && (
                      <>
                        <p className="truncate text-xs font-medium text-foreground">{cellTitle(cell)}</p>
                        {cellMeta(cell) && (
                          <p className="truncate text-[11px] text-muted-foreground">{cellMeta(cell)}</p>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
