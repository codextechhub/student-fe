import { Download, LockKeyhole } from "lucide-react";
import { useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar } from "@/components/layout/screen";
import { ReportCardPocket } from "@/components/report-card/pocket";
import { ReportCardSheet } from "@/components/report-card/report-card";
import { useReportCardPrint } from "@/components/report-card/print-page";
import { useAuthImageQuery, useReportCardQuery } from "@/redux/services/portal-api";

import "./report-card.css";

/**
 * The report card (design 2e), a screen opened from Results: its own back
 * bar, the card in small as the school printed it, and Download PDF at the
 * foot, which prints the A4 sheet (`ReportCardSheet`, hidden on screen). A
 * held or unreleased card shows neither, only why it isn't there.
 */
export function ReportCardPage() {
  const { termId } = useParams();
  const id = Number(termId);
  const validId = Number.isSafeInteger(id) && id > 0;
  const { data: card, isLoading, isError } = useReportCardQuery(id, { skip: !validId });
  const logo = card?.letterhead.logo_url ?? "";
  const { data: logoBlob } = useAuthImageQuery(logo, { skip: !logo });
  useReportCardPrint();

  const released = card && !card.held ? card : null;
  const shown = released ? { ...released, letterhead: { ...released.letterhead, logo_url: logoBlob ?? null } } : null;

  return (
    <PageShell className="report-page">
      {/* Some schools' term line starts with the card's name, which the title already says. */}
      <DetailBar title="Report card" subtitle={released?.term_line.replace(/^report card\s*[·:–-]\s*/i, "")} back="/results" backLabel="Back to results" />
      <div className="report-wrap print-hide">
        {isLoading && !card && <div className="report-loading" role="status" aria-label="Loading report card" />}
        {(!isLoading || !validId || isError) && !released && (
          <section className="screen-card report-unavailable" role="status">
            <span className="icon-tile"><LockKeyhole size={24} aria-hidden="true" /></span>
            <h2>This report card isn&apos;t available</h2>
            <p>The school may not have released it yet, or it may be held. Ask the school office if you expected to see it.</p>
          </section>
        )}
        {shown && <ReportCardPocket card={shown} />}
      </div>
      {shown && (
        <>
          <div className="print-area report-paper">
            <ReportCardSheet card={shown} />
          </div>
          <BottomBar>
            <button type="button" className="xs-button" onClick={() => window.print()}>
              <Download size={18} aria-hidden="true" />Download PDF
            </button>
          </BottomBar>
        </>
      )}
    </PageShell>
  );
}
