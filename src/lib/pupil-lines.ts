import { formatClock } from "./format";
import type { AttendanceToday, Me } from "@/redux/services/portal-api";

/**
 * The sentences the app writes about a pupil, kept apart from the screens so
 * every screen words the same fact the same way.
 */

/** The pupil's class, naming the year when it is next year's ("JSS2 A (from 2027/2028)"). */
export function classLine(me: Me): string {
  const { class_name, class_is_next_year } = me.student;
  if (!class_name) return "";
  return class_is_next_year && me.session ? `${class_name} (from ${me.session.name})` : class_name;
}

/** Today's line, in words a pupil reads: the mark, or why there is none. */
export function todayLine(today: AttendanceToday | null): string {
  if (!today) return "";
  switch (today.state) {
    case "MARKED": {
      const mark = (today.mark_label ?? "").toLowerCase();
      if (today.mark === "L" && today.arrived_at) return `You're marked late today (arrived ${formatClock(today.arrived_at)}).`;
      return mark ? `You're marked ${mark} today.` : "";
    }
    case "NOT_TAKEN":
      return "Today's register hasn't been taken yet.";
    case "CLOSED":
      return today.closed_reason ? `No school today: ${today.closed_reason}.` : "No school today.";
    case "SUSPENDED":
      return "You're not on today's register. Ask your class teacher if that looks wrong.";
    default:
      return "";
  }
}

/** The term's rate in three bands, encouraging and never scolding. */
export function rateLine(rate: number | null): string {
  if (rate === null) return "No register has been taken this term yet.";
  const percent = `${Math.round(rate)}%`;
  if (rate >= 90) return `${percent} attendance this term. Keep it up.`;
  if (rate >= 75) return `${percent} attendance this term.`;
  return `${percent} attendance this term. Talk to your class teacher if something is keeping you away.`;
}

