import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  term: {} as Record<string, unknown>,
  requestedTerm: null as number | null,
}));

vi.mock("@/redux/services/portal-api", () => ({
  useResultsQuery: (term: number | null) => { mocks.requestedTerm = term; return { data: mocks.term, isLoading: false, isError: false, isFetching: false }; },
  useSessionResultsQuery: () => ({ data: undefined, isLoading: true, isError: false }),
}));

import { ResultsPage } from "./results";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.requestedTerm = null;
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render() { act(() => root.render(<MemoryRouter><ResultsPage /></MemoryRouter>)); }

const term = { id: 7, name: "Third Term", session: "2025/26" };

describe("results release state", () => {
  it("shows the school's message without a score or report card for a held term", () => {
    mocks.term = { state: "withheld", term, terms: [{ ...term, state: "withheld" }], message: "Held by the school." };
    render();
    expect(container.textContent).toContain("Held by the school.");
    expect(container.textContent).not.toContain("Term average");
    expect(container.textContent).not.toContain("View term report card");
  });

  it("shows released figures and the report card route", () => {
    mocks.term = {
      state: "released", term, terms: [{ ...term, state: "released" }], class_name: "JSS 1 A",
      summary: { overall_average: "78.6", subjects: 1 },
      subjects: [{ name: "Mathematics", teacher: "Mr Ade", cells: [{ short_name: "CA", mark: 17, max_score: 20 }], percentage: "84", grade: "A", remark: null }],
    };
    render();
    expect(container.textContent).toContain("78.6%");
    expect(container.textContent).toContain("Mathematics");
    expect(container.querySelector('a[href="/results/card/7"]')).not.toBeNull();
    expect(container.textContent).not.toContain("Position");
    expect(container.textContent).not.toContain("Class average");
  });

  it("lets a pupil choose an older school year from published terms", () => {
    mocks.term = {
      state: "released", term, terms: [
        { id: 2, name: "First Term", session: "2023/24", state: "released" },
        { id: 7, name: "Third Term", session: "2025/26", state: "released" },
      ],
      summary: { overall_average: "78", subjects: 0 }, subjects: [],
    };
    render();
    const year = container.querySelector('.results-filter-controls select') as HTMLSelectElement;
    expect(year.options.length).toBe(2);
    act(() => { year.value = "2023/24"; year.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(mocks.requestedTerm).toBe(2);
  });
});
