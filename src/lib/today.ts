import type { TodayPeriod } from "@/redux/services/portal-api";

/**
 * How Home tells today's school day: one lesson in the blue card, the rest
 * under "Later today".
 *
 * The blue card holds the period under way ("Happening now"), or before it
 * starts the next one ("Up next"). Under way, the card also names the period
 * after it. "Later today" lists what is still to come after the card's
 * period, at most four. Which period is under way or next is the server's
 * word (`state`, worked out in the branch's time zone), never the phone's.
 */
export function todayPlan(periods: TodayPeriod[]): {
  card: TodayPeriod | null;
  cardIs: "now" | "next" | null;
  after: TodayPeriod | null;
  later: TodayPeriod[];
} {
  const now = periods.find((p) => p.state === "now") ?? null;
  const next = periods.find((p) => p.state === "next") ?? null;
  const card = now ?? next;
  const cardIndex = card ? periods.indexOf(card) : -1;
  const still = card ? periods.slice(cardIndex + 1).filter((p) => p.state !== "done") : [];
  return {
    card,
    cardIs: now ? "now" : next ? "next" : null,
    after: now ? (next ?? still[0] ?? null) : null,
    later: still.slice(0, 4),
  };
}

/** Minutes past midnight from "10:20" or "10:20:00", or null. */
function minutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(clock || "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * How far through a period the clock is: the share gone (0 to 1) and whole
 * minutes left. Null when the phone's clock is outside the period, which
 * happens when the phone is in another time zone from the school: then the
 * card shows no bar rather than a wrong one.
 */
export function periodProgress(period: Pick<TodayPeriod, "start_time" | "end_time">, now: Date): { done: number; minutesLeft: number } | null {
  const start = minutes(period.start_time);
  const end = minutes(period.end_time);
  if (start === null || end === null || end <= start) return null;
  const at = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  if (at < start || at > end) return null;
  return { done: (at - start) / (end - start), minutesLeft: Math.max(1, Math.ceil(end - at)) };
}
