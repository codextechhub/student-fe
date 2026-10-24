import { describe, expect, it } from "vitest";

import { accountBalanceWords, dayKey, formatClock, formatDate, formatDayLabel, formatLongDate, formatNaira, formatTimeOfDay, formatWhen } from "./format";

describe("formatting", () => {
  it("writes kobo as naira with two decimals", () => {
    expect(formatNaira(1168750)).toBe("₦11,687.50");
    expect(formatNaira(0)).toBe("₦0.00");
    expect(formatNaira(-500000)).toBe("-₦5,000.00");
  });

  it("reads a calendar date as written, whatever the reader's time zone", () => {
    expect(formatDate("2026-10-16")).toBe("16 Oct 2026");
    expect(formatLongDate("2026-10-16")).toBe("Friday, 16 Oct 2026");
    expect(formatDate("")).toBe("");
  });

  it("writes a school clock time without seconds or a leading zero", () => {
    expect(formatClock("08:00:00")).toBe("8:00");
    expect(formatClock("13:45:00")).toBe("13:45");
  });

  it("writes the time of day as the offline bar shows it", () => {
    expect(formatTimeOfDay(new Date(2026, 9, 16, 7, 12).getTime())).toBe("7:12am");
    expect(formatTimeOfDay(new Date(2026, 9, 16, 12, 5).getTime())).toBe("12:05pm");
    expect(formatTimeOfDay(new Date(2026, 9, 16, 0, 30).getTime())).toBe("12:30am");
  });
});

describe("reading a typed amount", () => {
  it("reads naira as kobo, with or without the sign and commas", async () => {
    const { parseNaira } = await import("./format");
    expect(parseNaira("20,000")).toBe(2_000_000);
    expect(parseNaira("₦1,000.50")).toBe(100_050);
    expect(parseNaira("0")).toBeNull();
    expect(parseNaira("12.345")).toBeNull();
    expect(parseNaira("abc")).toBeNull();
  });
});

describe("writing when a message was sent", () => {
  const now = new Date(2026, 9, 21, 15, 0);
  const at = (day: number, hour = 9, minute = 5) => new Date(2026, 9, day, hour, minute).toISOString();

  it("gives the time today, Yesterday, the weekday this week and the date after that", () => {
    expect(formatWhen(at(21, 7, 12), now)).toBe("7:12am");
    expect(formatWhen(at(20), now)).toBe("Yesterday");
    expect(formatWhen(at(17), now)).toBe("Sat");
    expect(formatWhen(at(10), now)).toBe("10 Oct 2026");
    expect(formatWhen("not a date", now)).toBe("");
  });

  it("labels a day in a thread and groups by the reader's day", () => {
    expect(formatDayLabel(at(21), now)).toBe("Today");
    expect(formatDayLabel(at(20), now)).toBe("Yesterday");
    expect(formatDayLabel(at(3), now)).toBe("3 Oct 2026");
    expect(dayKey(at(21, 1))).toBe(dayKey(at(21, 23)));
    expect(dayKey(at(21))).not.toBe(dayKey(at(20)));
  });

  it("writes an account balance by its side, never by a minus sign", () => {
    expect(accountBalanceWords(10_000_000)).toBe("₦100,000.00 owing");
    expect(accountBalanceWords(-2_000_000)).toBe("₦20,000.00 in credit");
    expect(accountBalanceWords(0)).toBe("₦0.00");
  });
});
