import { useState } from "react";
import { ArrowLeft, Download, LockKeyhole } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { ReportCardReader } from "@/components/report-card/reader";
import { ReportCardSheet } from "@/components/report-card/report-card";
import { useReportCardPrint } from "@/components/report-card/print-page";
import { useAuthImageQuery, useReportCardQuery } from "@/redux/services/portal-api";

import "./report-card.css";

/** A readable app view beside the school-issued A4 sheet used for printing. */
export function ReportCardPage() {
  const { termId } = useParams();
  const id = Number(termId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const { data: card, isLoading, isError } = useReportCardQuery(id, { skip: !validId });
  const logo = card?.letterhead.logo_url ?? "";
  const { data: logoBlob } = useAuthImageQuery(logo, { skip: !logo });
  const [view, setView] = useState<"read" | "paper">("read");
  const [report, setReport] = useState<"term" | "year">("term");
  useReportCardPrint();

  const released = card && !card.held ? card : null;
  const annual = report === "year" && !!released?.cumulative;

  return (
    <PageShell className="report-page">
      <div className="report-wrap">
        <div className="report-topline print-hide"><Link to="/results" className="report-back"><ArrowLeft size={17} aria-hidden="true" />Results</Link>{released && <button type="button" className="report-download" onClick={() => window.print()}><Download size={17} aria-hidden="true" />Download PDF</button>}</div>
        {isLoading && !card && <div className="report-loading print-hide" role="status" aria-label="Loading report card" />}
        {(!isLoading || !validId || isError) && !released && (
          <section className="report-unavailable print-hide" role="status">
            <span className="report-unavailable-icon"><LockKeyhole size={26} aria-hidden="true" /></span>
            <h2>This report card isn&apos;t available</h2>
            <p>The school may not have released it yet, or it may be held. Ask the school office if you expected to see it.</p>
          </section>
        )}
        {released && <>
          <div className={`report-view-switch print-hide${view === "paper" ? " is-paper" : ""}`} role="group" aria-label="Report card layout">
            <span className="report-view-indicator" aria-hidden="true" />
            <button type="button" aria-pressed={view === "read"} onClick={() => setView("read")}>Phone view</button>
            <button type="button" aria-pressed={view === "paper"} onClick={() => setView("paper")}>Printable A4</button>
          </div>
          {view === "read" && <div className="print-hide"><ReportCardReader card={released} report={annual ? "year" : "term"} onReportChange={setReport} /></div>}
          <div className={"print-area report-paper" + (view !== "paper" ? " is-hidden-screen" : "")}>
            <ReportCardSheet card={{ ...released, letterhead: { ...released.letterhead, logo_url: logoBlob ?? null } }} />
          </div>
        </>}
      </div>
    </PageShell>
  );
}
