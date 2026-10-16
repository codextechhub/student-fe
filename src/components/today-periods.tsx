import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TodayPeriod } from "@/redux/services/portal-api";

const STATE_BADGE: Record<TodayPeriod["state"], string> = { now: "Now", next: "Next", done: "Done", later: "" };

/**
 * Today's periods with where the day has got to, as Home and Timetable show
 * them: the one under way and the next one picked out, the ones gone faded.
 * The state comes from the server, worked out in the branch's time zone.
 */
export function TodayPeriods({ periods }: { periods: TodayPeriod[] }) {
  if (periods.length === 0) return <p className="text-xs text-muted-foreground">No classes today.</p>;
  return (
    <ol className="space-y-1">
      {periods.map((period) => {
        const isBreak = period.kind === "BREAK";
        const highlight = period.state === "now" || period.state === "next";
        const badge = STATE_BADGE[period.state];
        return (
          <li
            key={`${period.start_time}-${period.label}`}
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg px-2 py-2",
              highlight && "bg-primary/10",
              period.state === "done" && "opacity-60",
            )}
          >
            <span className={cn("w-11 shrink-0 text-xs tabular-nums", highlight ? "text-primary" : "text-muted-foreground")}>
              {formatClock(period.start_time)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">
                {isBreak ? period.label : period.subject || "Free period"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {isBreak
                  ? `${formatClock(period.start_time)} to ${formatClock(period.end_time)}`
                  : [period.teacher, period.room].filter(Boolean).join(" · ")}
              </p>
            </div>
            {badge && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  period.state === "done" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                )}
              >
                {badge}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** "Next: Basic Science, 9:30 · Science Lab", or "" when nothing is still to come. */
export function nextLine(periods: TodayPeriod[]): string {
  const next = periods.find((p) => p.state === "next" && p.kind !== "BREAK");
  if (!next) return "";
  return `Next: ${next.subject || "Free period"}, ${formatClock(next.start_time)}${next.room ? ` · ${next.room}` : ""}`;
}
