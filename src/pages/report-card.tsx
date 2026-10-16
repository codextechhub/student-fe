import { ArrowLeft, Download } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { ReportCardSheet } from "@/components/report-card/report-card";
import { useReportCardPrint } from "@/components/report-card/print-page";
import { Button } from "@/components/ui/button";
import { useAuthImageQuery, useReportCardQuery } from "@/redux/services/portal-api";

/**
 * One released term's report card, exactly as the school printed it.
 *
 * Drawn by the same sheet school-fe prints from, every word and figure the
 * server's. The year's last term's card carries the year, so it is also the
 * annual card. "Download PDF" opens the browser's print with the A4 portrait
 * page set for report cards, where "Save as PDF" keeps a copy; the server
 * makes no PDF of a report card.
 *
 * A held or unpublished term has no card: the server answers 404 and the page
 * says so. The school's crest is fetched with the pupil's token, since an
 * image cannot send one itself.
 */
export function ReportCardPage() {
  const { termId } = useParams();
  const id = Number(termId);
  const { data: card, isLoading, isError } = useReportCardQuery(id, { skip: !Number.isFinite(id) });
  const logo = card?.letterhead.logo_url ?? "";
  const { data: logoBlob } = useAuthImageQuery(logo, { skip: !logo });
  useReportCardPrint();

  return (
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <Link to="/results" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ArrowLeft className="size-4" /> Results
        </Link>
        {card && (
          <Button size="sm" onClick={() => window.print()}>
            <Download /> Download PDF
          </Button>
        )}
      </div>
      {card && <p className="print-hide -mt-2 text-[11px] text-muted-foreground">Choose &ldquo;Save as PDF&rdquo; as the printer to keep a copy.</p>}
      {isLoading && <div className="h-96 animate-pulse rounded-xl bg-muted" />}
      {isError && !card && (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          This report card isn&apos;t available. It may be held by the school; ask the school office.
        </p>
      )}
      {card && (
        <div className="print-area min-w-0 overflow-hidden rounded-xl border border-border">
          <ReportCardSheet card={{ ...card, letterhead: { ...card.letterhead, logo_url: logoBlob ?? null } }} />
        </div>
      )}
    </PageShell>
  );
}
