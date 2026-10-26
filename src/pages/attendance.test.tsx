/**
 * Attendance: the term's counts, the month with each day's mark, today ringed,
 * a date's record on tap, and the days to note.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));
vi.mock("@/redux/services/portal-api", () => ({
  useAttendanceQuery: () => ({ data: mocks.data, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
}));

import { AttendancePage } from "./attendance";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

const day = (date: string, state: string, mark: string | null = null, extra: Record<string, unknown> = {}) => ({ date, state, mark, arrived_at: null, closed_reason: null, ...extra });
const term = { id: 3, name: "First Term", session_name: "2026/2027", start_date: "2026-09-14", end_date: "2026-12-11", is_current: true };

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.data = {
    term, terms: [term],
    counts: { present: 3, late: 1, absent: 1, excused: 0, not_taken: 1, opened: 5, rate: 75 },
    days: [
      day("2026-10-01", "CLOSED", null, { closed_reason: "Independence Day" }),
      day("2026-10-02", "MARKED", "P"),
      day("2026-10-05", "MARKED", "L", { arrived_at: "08:12:00" }),
      day("2026-10-06", "MARKED", "A"),
      day("2026-10-07", "MARKED", "P"),
      day("2026-10-08", "NOT_TAKEN"),
    ],
    notes: [
      { date: "2026-10-06", mark: "A", mark_label: "Absent", reason_label: "Sick", note: "", arrived_at: null },
      { date: "2026-10-05", mark: "L", mark_label: "Late", reason_label: null, note: "", arrived_at: "08:12:00" },
    ],
    today: day("2026-10-07", "MARKED", "P"),
  };
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = () => act(() => root.render(<AttendancePage />));
const dayButton = (n: number) => [...container.querySelectorAll<HTMLButtonElement>("button.attendance-day")].find((b) => b.querySelector("span")?.textContent === String(n))!;

describe("attendance", () => {
  it("shows the term's rate and counts, with the term over the title", () => {
    render();
    expect(container.querySelector(".screen-title-eyebrow")?.textContent).toBe("First Term · 2026/2027");
    expect(container.querySelector(".attendance-ring")?.textContent).toBe("75%");
    expect([...container.querySelectorAll(".attendance-count")].map((c) => c.textContent)).toEqual(["3Present", "1Late", "1Absent", "0Excused"]);
    expect(container.querySelector(".attendance-summary")?.textContent).toContain("From 4 days with a register");
  });

  it("marks each day, rings today and opens on it, and strikes a closed day", () => {
    render();
    expect(dayButton(5).className).toContain("is-late");
    expect(dayButton(6).className).toContain("is-absent");
    expect(dayButton(1).className).toContain("is-closed");
    expect(dayButton(7).className).toContain("is-today");
    expect(dayButton(7).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".attendance-day-detail")?.textContent).toContain("Present");
  });

  it("shows a date's record when it is tapped", () => {
    render();
    act(() => dayButton(5).click());
    expect(container.querySelector(".attendance-day-detail")?.textContent).toBe("5 Oct 2026 · LateArrived 8:12");
  });

  it("lists the days to note with their weekday and mark, and only the marks the term has in the key", () => {
    render();
    const rows = [...container.querySelectorAll(".attendance-note")].map((r) => r.textContent);
    expect(rows).toEqual(["6OctTuesdaySickAbsent", "5OctMondayArrived 8:12Late"]);
    const legend = [...container.querySelectorAll(".attendance-legend li")].map((li) => li.textContent);
    expect(legend).toEqual(["Present", "Late", "Absent", "12No school", "No register yet"]);
  });
});
