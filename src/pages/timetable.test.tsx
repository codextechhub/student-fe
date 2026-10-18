import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/redux/services/portal-api", () => ({
  useTimetableQuery: () => ({ data: {
    published: true,
    class_name: "JSS1 A",
    days: [
      { day_of_week: 1, day_label: "Monday", is_today: true, cells: [{ start_time: "08:00", end_time: "08:40", kind: "LESSON", label: "Mathematics", subject: "Mathematics" }] },
      { day_of_week: 2, day_label: "Tuesday", is_today: false, cells: [{ start_time: "09:00", end_time: "09:40", kind: "LESSON", label: "English", subject: "English" }] },
    ],
    today: { date: "2026-10-19", periods: [{ start_time: "08:00", end_time: "08:40", kind: "LESSON", label: "Mathematics", subject: "Mathematics", state: "now" }] },
  }, isLoading: false, isError: false }),
}));

import { TimetablePage } from "./timetable";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("timetable week navigation", () => {
  it("shows the published pattern for another week without calling a future class current", () => {
    act(() => root.render(<TimetablePage />));
    act(() => (container.querySelector('button[aria-label="Next week"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Showing the current published weekly pattern");
    expect(container.querySelector(".timetable-lesson-badge.is-now")).toBeNull();
    expect(container.textContent).toContain("Mathematics");
    expect(container.querySelector('button[aria-label="Choose a timetable date"]')).not.toBeNull();
  });

  it("opens the chosen calendar day and keeps that day selected across weeks", () => {
    act(() => root.render(<TimetablePage />));
    act(() => (container.querySelector('button[aria-label="Choose a timetable date"]') as HTMLButtonElement).click());
    act(() => (document.querySelector('button[aria-label="Tuesday, 20 October 2026"]') as HTMLButtonElement).click());
    expect(container.querySelector(".timetable-day-button.is-selected")?.textContent).toContain("Tue");
    expect(container.querySelector(".timetable-day-heading")?.textContent).toContain("Tuesday · 20 Oct");
    expect(container.querySelector(".timetable-lessons")?.textContent).toContain("English");
    expect(container.querySelector(".timetable-lessons")?.textContent).not.toContain("Mathematics");

    act(() => (container.querySelector('button[aria-label="Next week"]') as HTMLButtonElement).click());
    expect(container.querySelector(".timetable-day-button.is-selected")?.textContent).toContain("Tue");
    expect(container.querySelector(".timetable-day-heading")?.textContent).toContain("Tuesday · 27 Oct");
  });
});
