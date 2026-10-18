import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReportCard } from "@/redux/services/report-card-types";

const mocks = vi.hoisted(() => ({ card: null as ReportCard | null }));
vi.mock("@/redux/services/portal-api", () => ({
  useReportCardQuery: () => ({ data: mocks.card, isLoading: false, isError: false }),
  useAuthImageQuery: () => ({ data: null }),
}));
vi.mock("@/components/report-card/print-page", () => ({ useReportCardPrint: () => {} }));
vi.mock("@/components/report-card/report-card", () => ({ ReportCardSheet: () => <div>Printable school sheet</div> }));

import { ReportCardPage } from "./report-card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
const card: ReportCard = {
  letterhead: { school_name: "Lagoon View School", logo_url: null, branch_name: null, branch_address: null, phone: null },
  term_line: "Third Term · 2025/2026",
  facts: [{ label: "Name", value: "Ebere Bello" }, { label: "Class", value: "JSS1 A" }],
  components: [{ short_name: "CA", max_score: 40 }, { short_name: "Exam", max_score: 60 }],
  subjects: [{ name: "Mathematics", cells: ["30", "42"], total: 72, grade: "B", remark: "Good effort" }],
  totals: [{ label: "Term average", value: "72%" }],
  grading_key: "A 75–100",
  cumulative: { terms: ["First", "Second", "Third"], subjects: [{ name: "Mathematics", totals: ["68", "70", "72"], annual_average: "70" }], annual_average: "70%", promotion_line: "Promoted to JSS2 A" },
  version: 1,
  held: false,
};
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.card = card;
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
function render() {
  act(() => root.render(<MemoryRouter initialEntries={["/results/card/3"]}><Routes><Route path="/results/card/:termId" element={<ReportCardPage />} /></Routes></MemoryRouter>));
}

describe("report card reader", () => {
  it("shows only served fields and opens the year view from the same card", () => {
    render();
    expect(container.textContent).toContain("Ebere Bello");
    expect(container.textContent).toContain("72%");
    expect(container.textContent).not.toContain("Class average");
    expect(container.textContent).not.toContain("Principal’s comment");
    const subject = container.querySelector(".report-subject") as HTMLDetailsElement;
    act(() => subject.open = true);
    expect(subject.textContent).toContain("CA · out of 40");
    act(() => (container.querySelector('button[role="tab"][aria-selected="false"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Promoted to JSS2 A");
    expect(container.textContent).toContain("70%");
    expect(container.querySelector(".report-paper.is-hidden-screen")).not.toBeNull();
    act(() => (container.querySelector('button[aria-pressed="false"]') as HTMLButtonElement).click());
    expect(container.querySelector(".report-paper.is-hidden-screen")).toBeNull();
    expect(container.querySelector(".report-view-switch.is-paper .report-view-indicator")).not.toBeNull();
  });

  it("never renders a held card or offers its PDF", () => {
    mocks.card = { ...card, held: true, teacher_comment: "Sensitive school note" };
    render();
    expect(container.textContent).toContain("This report card isn't available");
    expect(container.textContent).not.toContain("Sensitive school note");
    expect(container.textContent).not.toContain("Download PDF");
    expect(container.textContent).not.toContain("Printable school sheet");
  });
});
