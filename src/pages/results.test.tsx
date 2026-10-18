import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  term: {} as Record<string, unknown>,
}));

vi.mock("@/redux/services/portal-api", () => ({
  useResultsQuery: () => ({ data: mocks.term, isLoading: false, isError: false, isFetching: false }),
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
});
