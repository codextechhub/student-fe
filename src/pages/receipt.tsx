import { useState } from "react";
import { Check, Clock3, Download } from "lucide-react";
import { Link, useParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { BottomBar, DetailBar } from "@/components/layout/screen";
import { accountBalanceWords, formatDate, formatNaira } from "@/lib/format";
import { useLazyReceiptPdfQuery, useReceiptQuery, type Receipt } from "@/redux/services/portal-api";

import "./receipt.css";

/**
 * A confirmed payment's receipt (design 5j), with the balance frozen when it
 * was booked: a screen of its own over Fees, the payment in a green card, the
 * receipt as a ticket under it, and Download PDF at the foot. Before a
 * payment is confirmed there is no receipt yet, and the screen says so (5k).
 */
export function ReceiptPage() {
  const { paymentRef } = useParams();
  const ref = Number(paymentRef);
  const validRef = Number.isSafeInteger(ref) && ref > 0;
  const { data: receipt, isLoading, isError } = useReceiptQuery(ref, { skip: !validRef });
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
    <PageShell className="receipt-page">
      <DetailBar title="Receipt" back="/fees" backText="My fees" backLabel="Back to my fees" />
      <div className="receipt-wrap">
        {isLoading && !receipt && <div className="receipt-loading" role="status" aria-label="Loading receipt" />}
        {(!validRef || isError) && !receipt && <Unavailable />}
        {receipt && (
          <>
            <section className="receipt-summary" aria-label="Confirmed payment">
              <div className="screen-orb" aria-hidden="true" />
              <span className="receipt-summary-label">Payment received</span>
              <strong className="receipt-summary-amount">{formatNaira(receipt.amount)}</strong>
              <div className="receipt-summary-bottom"><span className="receipt-status">Received</span><span>{formatDate(receipt.paid_on)}</span></div>
            </section>
            <ReceiptDocument receipt={receipt} />
            {pdfError && <p role="alert" className="receipt-pdf-error">{pdfError}</p>}
          </>
        )}
      </div>
      {receipt && (
        <BottomBar>
          <button type="button" className="xs-button receipt-download" onClick={download} disabled={isFetching}>
            <Download size={18} aria-hidden="true" />{isFetching ? "Preparing PDF…" : "Download PDF receipt"}
          </button>
        </BottomBar>
      )}
    </PageShell>
  );
}

function Unavailable() {
  return <section className="screen-card receipt-unavailable" role="status">
    <span className="receipt-unavailable-icon"><Clock3 size={28} aria-hidden="true" /></span>
    <h2>Receipt not available yet</h2>
    <p>A payment gets its receipt once it is confirmed. Check your payment status in Fees.</p>
    <Link to="/fees" className="xs-button xs-button--plain receipt-secondary">Back to My fees</Link>
  </section>;
}

function ReceiptDocument({ receipt }: { receipt: Receipt }) {
  return <article className="receipt-document" aria-label="Payment receipt">
    <div className="receipt-document-top">
      <div><p className="receipt-issuer">{receipt.issuer_name}</p><p className="receipt-issuer-sub">Official payment receipt</p></div>
      <span className="receipt-document-stamp"><Check size={22} aria-hidden="true" /></span>
    </div>
    <div className="receipt-document-id"><span>Receipt number</span><strong>{receipt.receipt_number}</strong></div>
    <div className="receipt-tear" aria-hidden="true" />
    <div className="receipt-document-body">
      <dl className="receipt-details">
        <Fact label="Received from" value={receipt.received_from} />
        <Fact label="Payment date" value={formatDate(receipt.paid_on)} />
        <Fact label="Payment method" value={receipt.method_label} />
        <Fact label="Reference" value={receipt.reference} reference />
        {receipt.payer_name && <Fact label="Paid by" value={receipt.payer_name} />}
      </dl>
      <h2 className="receipt-section-title">Applied to</h2>
      <div className="receipt-lines">
        {receipt.lines.map((line, index) => <div className="receipt-line" key={`${line.invoice_number}-${index}`}>
          <div><strong>{line.title}</strong><small>{line.invoice_number}</small></div>
          <span>{formatNaira(line.amount_applied)}</span>
        </div>)}
      </div>
      <div className="receipt-total"><span>Amount received</span><strong>{formatNaira(receipt.amount)}</strong></div>
      <div className="receipt-balance"><span>Account balance after this payment</span><strong>{accountBalanceWords(receipt.balance_after)}</strong></div>
      <p className="receipt-historic">This was the balance when the payment was recorded. Your balance in Fees may have changed since then.</p>
    </div>
  </article>;
}

function Fact({ label, value, reference = false }: { label: string; value: string; reference?: boolean }) {
  return <div><dt>{label}</dt><dd className={reference ? "is-reference" : undefined}>{value || "-"}</dd></div>;
}
