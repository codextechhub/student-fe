import { useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { formatDate, formatNaira } from "@/lib/format";
import { useLazyReceiptPdfQuery, useReceiptQuery } from "@/redux/services/portal-api";

/**
 * One confirmed payment's receipt.
 *
 * Every figure is the server's, the balance after the payment included: it is
 * what was owed right after this payment, frozen when the receipt was booked,
 * not today's balance. "Download PDF" saves the same PDF the school's receipt
 * email attaches. A payment not yet confirmed, or not the pupil's, has no
 * receipt.
 */
export function ReceiptPage() {
  const { paymentRef } = useParams();
  const ref = Number(paymentRef);
  const { data: receipt, isLoading, isError } = useReceiptQuery(ref, { skip: !Number.isFinite(ref) });
  const [fetchPdf, { isFetching }] = useLazyReceiptPdfQuery();
  const [pdfError, setPdfError] = useState("");

  const download = async () => {
    setPdfError("");
    const result = await fetchPdf(ref);
    if (!result.data) return setPdfError("The PDF can't be downloaded right now. Try again in a moment.");
    const link = document.createElement("a");
    link.href = result.data;
    link.download = `receipt-${receipt?.receipt_number || ref}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(result.data!), 10_000);
  };

  return (
    <PageShell grid className="mx-auto w-full max-w-xl content-start gap-4 pt-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/fees" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ArrowLeft className="size-4" /> Fees
        </Link>
        {receipt && (
          <Button size="sm" onClick={download} loading={isFetching} disabled={isFetching}>
            <Download /> Download PDF
          </Button>
        )}
      </div>
      {pdfError && <p role="alert" className="text-xs text-destructive">{pdfError}</p>}
      {isLoading && <div className="h-80 animate-pulse rounded-xl bg-muted" />}
      {isError && !receipt && (
        <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          This receipt isn&apos;t available. A payment gets its receipt once it is confirmed.
        </p>
      )}
      {receipt && (
        <article className="grid gap-4 rounded-xl border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{receipt.issuer_name}</p>
              <p className="text-xs text-muted-foreground">Payment receipt</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground">RECEIPT</p>
              <p className="font-mono text-sm font-semibold">{receipt.receipt_number}</p>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Fact label="Received from" value={receipt.received_from} />
            <Fact label="Date" value={formatDate(receipt.paid_on)} />
            <Fact label="Paid via" value={receipt.method_label} />
            <Fact label="Reference" value={receipt.reference} mono />
            {receipt.payer_name && <Fact label="Paid by" value={receipt.payer_name} />}
          </dl>
          <div className="grid gap-1.5 border-t border-border pt-3 text-sm">
            {receipt.lines.map((line) => (
              <div key={line.invoice_number} className="flex justify-between gap-3">
                <span className="min-w-0 text-muted-foreground">
                  {line.title} · {line.invoice_number}
                </span>
                <span className="font-mono tabular-nums">{formatNaira(line.amount_applied)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-semibold">
              <span>Amount paid</span>
              <span className="font-mono tabular-nums">{formatNaira(receipt.amount)}</span>
            </div>
            <div className="flex justify-between gap-3 text-muted-foreground">
              <span>Balance left after this payment</span>
              <span className="font-mono tabular-nums">{formatNaira(receipt.balance_after)}</span>
            </div>
          </div>
        </article>
      )}
    </PageShell>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "text-sm text-foreground"}>{value || "-"}</dd>
    </div>
  );
}
