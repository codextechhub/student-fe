import { describe, expect, it } from "vitest";

import type { TodayPeriod } from "@/redux/services/portal-api";

import { periodProgress, todayPlan } from "./today";

const period = (subject: string, start: string, end: string, state: TodayPeriod["state"], kind = "LESSON"): TodayPeriod => ({
  start_time: `${start}:00`, end_time: `${end}:00`, kind, label: kind === "BREAK" ? subject : "", subject: kind === "BREAK" ? "" : subject, state,
});
const names = (periods: TodayPeriod[]) => periods.map((p) => p.subject || p.label);

const day = (states: TodayPeriod["state"][]) => [
  period("English", "8:00", "8:40", states[0]),
  period("Short break", "8:40", "9:00", states[1], "BREAK"),
  period("Mathematics", "9:00", "9:40", states[2]),
  period("Computer Studies", "9:40", "10:20", states[3]),
  period("French", "10:20", "11:00", states[4]),
];

describe("today on Home", () => {
  it("puts the lesson under way in the card, names the one after, and lists the rest", () => {
    const plan = todayPlan(day(["done", "done", "now", "next", "later"]));
    expect(plan.cardIs).toBe("now");
    expect(plan.card?.subject).toBe("Mathematics");
    expect(plan.after?.subject).toBe("Computer Studies");
    expect(names(plan.later)).toEqual(["Computer Studies", "French"]);
  });

  it("puts the next lesson in the card before it starts, and does not list it twice", () => {
    const plan = todayPlan(day(["next", "later", "later", "later", "later"]));
    expect(plan.cardIs).toBe("next");
    expect(plan.card?.subject).toBe("English");
    expect(plan.after).toBeNull();
    expect(names(plan.later)).toEqual(["Short break", "Mathematics", "Computer Studies", "French"]);
  });

  it("has no card once the day is over", () => {
    const plan = todayPlan(day(["done", "done", "done", "done", "done"]));
    expect(plan.card).toBeNull();
    expect(plan.later).toEqual([]);
  });

  it("lists at most four", () => {
    const periods = [period("A", "8:00", "8:40", "now"), ...["B", "C", "D", "E", "F"].map((s, i) => period(s, `${9 + i}:00`, `${9 + i}:40`, i === 0 ? "next" : "later"))];
    expect(names(todayPlan(periods).later)).toEqual(["B", "C", "D", "E"]);
  });
});

describe("how far through a lesson", () => {
  const lesson = { start_time: "10:20:00", end_time: "11:00:00" };
  it("gives the share gone and the minutes left", () => {
    const progress = periodProgress(lesson, new Date(2026, 9, 26, 10, 45));
    expect(progress?.minutesLeft).toBe(15);
    expect(progress?.done).toBeCloseTo(25 / 40);
  });

  it("gives nothing when the phone's clock is outside the lesson", () => {
    expect(periodProgress(lesson, new Date(2026, 9, 26, 14, 0))).toBeNull();
    expect(periodProgress({ start_time: "", end_time: "" }, new Date())).toBeNull();
  });
});
