import { useState } from "react";
import { Check, ChevronDown, Clock3, Info, Receipt as ReceiptIcon, Wallet } from "lucide-react";
import { Link } from "react-router";

import { TransferAccountCard } from "@/components/fees/transfer-account-card";
import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import { useFeesQuery, useMeQuery, usePaymentsQuery, useTransferAccountQuery, type Invoice, type Payment } from "@/redux/services/portal-api";

import "./fees.css";

/** School bills and payments, with only confirmed money counted as paid. */
export function FeesPage() {
  const { data: fees, isLoading, isError, refetch } = useFeesQuery();
  const { data: payments } = usePaymentsQuery();
  const { data: account } = useTransferAccountQuery();
  const { data: me } = useMeQuery();
  const signedInName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.fullName);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const nextDue = fees?.invoices.filter((invoice) => invoice.balance > 0 && invoice.due_date).map((invoice) => invoice.due_date!).sort()[0];

  return (
    <PageShell className="fees-page">
      <div className="fees-wrap">
        <header className="fees-heading"><p>Your school account</p><h1>Know what is due, paid and on its way.</h1></header>
        {isLoading && !fees && <div className="fees-loading" role="status" aria-label="Loading fees" />}
        {isError && !fees && <div className="fees-notice" role="alert">Your fees can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></div>}
        {fees && (
          <div className="fees-layout">
            <div className="fees-overview">
              <section className="fees-hero" aria-label="Fee balance">
                <span className="fees-hero-label">{fees.balance < 0 ? "In credit" : fees.invoices.length === 0 ? "No bills yet" : fees.balance === 0 ? "All paid" : "Balance to pay"}</span>
                <div className="fees-hero-main"><div><strong>{formatNaira(Math.abs(fees.balance))}</strong><p>{fees.balance < 0 ? "Ready for your next school bill" : fees.invoices.length === 0 ? "New bills will appear here" : fees.balance === 0 ? "Your school bills are settled" : "Remaining on your school bill"}</p></div><span className="fees-hero-icon"><Wallet aria-hidden="true" size={23} /></span></div>
                {fees.total_billed > 0 && <><div className="fees-progress-label"><span>Paid so far</span><span>{formatNaira(fees.total_paid)} of {formatNaira(fees.total_billed)}</span></div><div className="fees-progress" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, (fees.total_paid / fees.total_billed) * 100))}%` }} /></div></>}
                <span className="fees-hero-note">{nextDue && fees.balance > 0 ? `Due ${formatDate(nextDue)}` : fees.balance < 0 ? "Credit available for your next bill" : fees.balance === 0 && fees.invoices.length > 0 ? "Nothing to pay right now" : "Your account is ready when needed"}</span>
              </section>
              <div className="fees-stats"><Stat label="Total billed" value={formatNaira(fees.total_billed)} /><Stat label="Paid so far" value={formatNaira(fees.total_paid)} /></div>
              {account?.state === "ISSUED" && <section className="fees-account-section"><Heading title="Pay by transfer" description="Your own account number for school fees" /><TransferAccountCard account={account} pupilName={me?.student.full_name || signedInName} title="Your account number" /></section>}
              {fees.can_pay && <div className="fees-guardian"><Info size={17} aria-hidden="true" /><p><strong>Fees are normally paid by your parent or guardian.</strong> If they can&apos;t pay through their own app right now, you can pay here. Card details are entered on the secure gateway.</p></div>}
            </div>
            <div className="fees-detail">
              <section><Heading title="School bills" description="Open a bill to see its full breakdown" first />{fees.invoices.length === 0 ? <div className="fees-surface fees-empty">No bills yet. They will appear here when the school issues one.</div> : <ul className="fees-invoices">{fees.invoices.map((invoice, index) => <InvoiceCard key={invoice.invoice_ref} invoice={invoice} openAtFirst={index === 0} canPay={fees.can_pay && !offline} offline={offline} />)}</ul>}</section>
              <section><Heading title="Payment history" description="Confirmed payments and transfers on their way" /><div className="fees-surface fees-history">{!payments || payments.length === 0 ? <p className="fees-empty">No payments yet.</p> : <ul>{payments.map((payment) => <PaymentRow key={payment.reference} payment={payment} />)}</ul>}</div></section>
            </div>
          </div>
        )}
        {!fees && account?.state === "ISSUED" && <section className="fees-account-section"><Heading title="Pay by transfer" description="Your own account number for school fees" /><TransferAccountCard account={account} pupilName={me?.student.full_name || signedInName} title="Your account number" /></section>}
      </div>
    </PageShell>
  );
}

function Heading({ title, description, first = false }: { title: string; description: string; first?: boolean }) {
  return <div className={cn("fees-section-heading", first && "is-first")}><h2>{title}</h2><p>{description}</p></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="fees-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function InvoiceCard({ invoice, openAtFirst, canPay, offline }: { invoice: Invoice; openAtFirst: boolean; canPay: boolean; offline: boolean }) {
  const [open, setOpen] = useState(openAtFirst);
  return (
    <li className="fees-invoice fees-surface">
      <button type="button" aria-expanded={open} aria-controls={`fees-invoice-${invoice.invoice_ref}`} onClick={() => setOpen((value) => !value)} className="fees-invoice-toggle">
        <span className="fees-invoice-title"><strong>{invoice.title}</strong><small>{[invoice.number, invoice.due_date ? `Due ${formatDate(invoice.due_date)}` : null].filter(Boolean).join(" · ")}</small></span>
        <span className={cn("fees-invoice-status", invoice.status === "PAID" ? "is-paid" : invoice.status === "PARTIAL" ? "is-partial" : "is-due")}>{invoice.status_label}</span>
        <ChevronDown className={cn("fees-invoice-chevron", open && "is-open")} size={17} aria-hidden="true" />
      </button>
      {open && <div className="fees-invoice-detail" id={`fees-invoice-${invoice.invoice_ref}`}><dl>{invoice.lines.map((line, index) => <div className="fees-invoice-line" key={index}><dt>{line.description}</dt><dd>{formatNaira(line.amount)}</dd></div>)}<div className="fees-invoice-line is-total"><dt>Total billed</dt><dd>{formatNaira(invoice.total)}</dd></div><div className="fees-invoice-line"><dt>Paid</dt><dd>{formatNaira(invoice.paid)}</dd></div><div className="fees-invoice-line is-balance"><dt>Balance</dt><dd>{formatNaira(invoice.balance)}</dd></div></dl>
        {invoice.balance > 0 ? canPay ? <Link className="fees-pay-link" to={`/fees/pay/${invoice.invoice_ref}`}>Pay balance <span aria-hidden="true">→</span></Link> : offline ? <p className="fees-invoice-note">You can pay when you&apos;re back online.</p> : null : <p className="fees-invoice-note is-paid"><Check size={16} aria-hidden="true" />This bill is fully paid. Thank you.</p>}
      </div>}
    </li>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const confirmed = payment.status === "CONFIRMED";
  const by = payment.payer_name ? `by ${payment.payer_name}` : payment.source_label || "";
  return <li className="fees-payment">
    <span className={cn("fees-payment-icon", !confirmed && "is-pending")}>{confirmed ? <Check size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}</span>
    <div className="fees-payment-main"><strong>{formatNaira(payment.amount)}</strong><span>{[payment.paid_on ? formatDate(payment.paid_on) : null, confirmed ? payment.method_label : "Waiting for confirmation", by].filter(Boolean).join(" · ")}</span></div>
    <div className="fees-payment-side"><b className={cn(!confirmed && "is-pending")}>{payment.status_label}</b>{payment.has_receipt && payment.payment_ref ? <Link to={`/fees/receipts/${payment.payment_ref}`}><ReceiptIcon size={13} aria-hidden="true" />Receipt</Link> : <small>No receipt yet</small>}</div>
  </li>;
}
