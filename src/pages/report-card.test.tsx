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

describe("the report card", () => {
  it("shows the card in small with only the fields the school served, and offers the PDF", () => {
    render();
    const pocket = container.querySelector(".report-pocket")!;
    expect(pocket.textContent).toContain("Lagoon View School");
    expect(pocket.textContent).toContain("Ebere Bello");
    const header = [...pocket.querySelectorAll(".report-pocket-table thead th")].map((th) => th.textContent);
    expect(header.slice(0, 5)).toEqual(["Subject", "CA40", "Exam60", "Total", "Grd"]);
    expect(pocket.querySelector(".report-pocket-table tbody tr")?.textContent).toBe("Mathematics304272B");
    expect(pocket.textContent).toContain("72%");
    expect(pocket.textContent).not.toContain("Class avg");
    expect(pocket.textContent).not.toContain("Principal's comment");
    expect(container.querySelector(".detail-bar h1")?.textContent).toBe("Report card");
    expect(container.querySelector(".detail-bar p")?.textContent).toBe("Third Term · 2025/2026");
    expect(container.querySelector('.detail-bar a[href="/results"]')).not.toBeNull();
    expect(container.textContent).toContain("Download PDF");
    expect(container.querySelector(".report-paper")?.textContent).toBe("Printable school sheet");
  });

  it("adds the school year on a last term's card", () => {
    render();
    const year = [...container.querySelectorAll(".report-pocket-box")].find((box) => box.textContent?.startsWith("The school year"))!;
    expect(year.textContent).toContain("Promoted to JSS2 A");
    expect(year.querySelector("tbody tr")?.textContent).toBe("Mathematics68707270");
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
