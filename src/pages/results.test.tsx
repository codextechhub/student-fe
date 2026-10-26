import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  term: {} as Record<string, unknown>,
  requestedTerm: null as number | null,
  session: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/redux/services/portal-api", () => ({
  useResultsQuery: (term: number | null) => { mocks.requestedTerm = term; return { data: mocks.term, isLoading: false, isError: false, isFetching: false }; },
  useTimetableQuery: () => ({ data: undefined }),
  useSessionResultsQuery: () => ({ data: mocks.session, isLoading: !mocks.session, isError: false }),
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
  mocks.session = undefined;
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

  it("colours a grade by how good it is", () => {
    mocks.term = {
      state: "released", term, terms: [{ ...term, state: "released" }],
      summary: { overall_average: "70", subjects: 2 },
      subjects: [
        { name: "Mathematics", teacher: null, cells: [], percentage: "84", grade: "A1", remark: null },
        { name: "French", teacher: null, cells: [], percentage: "52", grade: "D7", remark: null },
      ],
    };
    render();
    const pills = [...container.querySelectorAll(".results-subject-score .pill")].map((p) => p.className);
    expect(pills[0]).toContain("pill--good");
    expect(pills[1]).toContain("pill--bad");
  });
});

describe("the full session", () => {
  const showSession = () => {
    render();
    act(() => ([...container.querySelectorAll(".results-tabs button")].find((b) => b.textContent === "Full session") as HTMLButtonElement).click());
  };

  it("shows each released term and the terms still to come", () => {
    mocks.term = { state: "not_published", term: null, terms: [] };
    mocks.session = {
      state: "released", session: { id: 1, name: "2026/2027" }, terms_released: 1, terms_total: 3, cumulative: null,
      terms: [{ id: 7, name: "First Term", session: "2026/2027", state: "released", average: "75.1" }],
    };
    showSession();
    const tiles = [...container.querySelectorAll(".results-term-card")].map((t) => t.textContent);
    expect(tiles).toEqual(["First Term75.1%Latest", "Second term–Not yet", "Third term–Not yet"]);
    expect(container.querySelector(".results-year-value")?.textContent).toBe("–");
    expect(container.textContent).toContain("once the year's last term is released");
  });

  it("shows the year's block and how each subject moved once the year is complete", () => {
    mocks.term = { state: "not_published", term: null, terms: [] };
    mocks.session = {
      state: "released", session: { id: 1, name: "2025/2026" }, terms_released: 2, terms_total: 2,
      terms: [
        { id: 6, name: "First Term", session: "2025/2026", state: "released", average: "70" },
        { id: 7, name: "Second Term", session: "2025/2026", state: "released", average: "74" },
      ],
      cumulative: {
        terms: [], annual_average: "72", promotion: "Promoted to JSS 2", remark: "Good year.", class_teacher: "Mrs Bello",
        subjects: [{ name: "Mathematics", terms: [{ term: "First Term", percentage: "70" }, { term: "Second Term", percentage: "78" }], annual_average: "74", annual_grade: "B" }],
      },
    };
    showSession();
    expect(container.querySelector(".results-year-value")?.textContent).toBe("72.0%");
    expect(container.textContent).toContain("Promoted to JSS 2");
    expect(container.querySelector(".results-year-terms")?.textContent).toBe("70 → 78▲ 8 vs last term");
    expect(container.querySelector('a[href="/results/card/7"]')?.textContent).toContain("annual report card");
  });
});
