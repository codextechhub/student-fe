import { describe, expect, it } from "vitest";

import type { AttendanceDay } from "@/redux/services/portal-api";

import { monthsOf } from "./attendance-months";

const day = (date: string, mark: AttendanceDay["mark"] = "P"): AttendanceDay => ({
  date, state: "MARKED", mark, arrived_at: null, closed_reason: null,
});

describe("month calendars", () => {
  it("gives every month the term touches a calendar, Monday first", () => {
    const months = monthsOf([day("2026-09-30"), day("2026-10-01"), day("2026-10-16", "A")]);
    expect(months.map((m) => m.label)).toEqual(["September 2026", "October 2026"]);
    // 1 October 2026 is a Thursday: three blank cells before it.
    expect(months[1].lead).toBe(3);
    expect(months[1].days).toHaveLength(31);
    expect(months[1].days[15]?.mark).toBe("A");
    expect(months[1].days[4]).toBeNull();
  });

  it("reads dates as written, whatever the time zone", () => {
    const [june] = monthsOf([day("2026-06-01")]);
    // 1 June 2026 is a Monday.
    expect(june.lead).toBe(0);
    expect(june.days[0]?.date).toBe("2026-06-01");
  });
});
