import { describe, expect, it } from "vitest";

import type { AttendanceToday } from "@/redux/services/portal-api";

import { rateLine, todayLine } from "./pupil-lines";

const today = (over: Partial<AttendanceToday>): AttendanceToday => ({
  date: "2026-10-16", state: "MARKED", mark: "P", mark_label: "Present", arrived_at: null, closed_reason: null, ...over,
});

describe("how the app words attendance", () => {
  it("says today's mark, with the arrival time when late", () => {
    expect(todayLine(today({}))).toBe("You're marked present today.");
    expect(todayLine(today({ mark: "L", mark_label: "Late", arrived_at: "08:20:00" }))).toBe(
      "You're marked late today (arrived 8:20).",
    );
  });

  it("says why there is no mark, never inventing one", () => {
    expect(todayLine(today({ state: "NOT_TAKEN", mark: null, mark_label: null }))).toBe(
      "Today's register hasn't been taken yet.",
    );
    expect(todayLine(today({ state: "CLOSED", mark: null, closed_reason: "Public holiday" }))).toBe(
      "No school today: Public holiday.",
    );
    expect(todayLine(null)).toBe("");
  });

  it("words the rate in three bands, and says when nothing is taken yet", () => {
    expect(rateLine(94)).toBe("94% attendance this term. Keep it up.");
    expect(rateLine(80)).toBe("80% attendance this term.");
    expect(rateLine(60)).toContain("Talk to your class teacher");
    expect(rateLine(null)).toBe("No register has been taken this term yet.");
  });
});
