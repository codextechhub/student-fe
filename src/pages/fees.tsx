import { useState } from "react";
import { Check, ChevronDown, Clock3, Info, Receipt as ReceiptIcon, SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";
import { Link } from "react-router";

import { TransferAccountCard } from "@/components/fees/transfer-account-card";
import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import { useFeesQuery, useMeQuery, usePaymentsQuery, useTransferAccountQuery, type DebitNote, type Invoice, type Payment } from "@/redux/services/portal-api";

import "./fees.css";

/**
 * School bills and payments, with only confirmed money counted as paid.
 *
 * Charges added after a bill sit in the bills list with the bills, because the
 * balance counts them: a pupil who sees a balance must be able to find every
 * amount that makes it up. The bill filters apply to both.
 */
export function FeesPage() {
  const [billYear, setBillYear] = useState("all");
  const [billStatus, setBillStatus] = useState("all");
  const [paymentYear, setPaymentYear] = useState("all");
  const { data: fees, isLoading, isError, refetch } = useFeesQuery();
  const { data: payments } = usePaymentsQuery();
  const { data: account } = useTransferAccountQuery();
  const { data: me } = useMeQuery();
  const signedInName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.fullName);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const nextDue = fees?.invoices.filter((invoice) => invoice.balance > 0 && invoice.due_date).map((invoice) => invoice.due_date!).sort()[0];
  const billYears = [...new Set([...(fees?.invoices ?? []).map((invoice) => invoice.invoice_date ?? invoice.due_date), ...(fees?.debit_notes ?? []).map((charge) => charge.date)].map((date) => date?.slice(0, 4)).filter((year): year is string => !!year))].sort().reverse();
  const paymentYears = [...new Set((payments ?? []).map((payment) => payment.paid_on?.slice(0, 4)).filter((year): year is string => !!year))].sort().reverse();
  const charges = fees?.debit_notes ?? [];
  const hasBills = (fees?.invoices.length ?? 0) + charges.length > 0;
  const matches = (date: string | null | undefined, balance: number) => (billYear === "all" || !!date?.startsWith(billYear)) && (billStatus === "all" || (billStatus === "due" ? balance > 0 : balance <= 0));
  const visibleBills = fees?.invoices.filter((invoice) => matches(invoice.invoice_date ?? invoice.due_date, invoice.balance)) ?? [];
  const visibleCharges = charges.filter((charge) => matches(charge.date, charge.balance));
  const visiblePayments = payments?.filter((payment) => paymentYear === "all" || payment.paid_on?.startsWith(paymentYear)) ?? [];

  return (
    <PageShell className="fees-page">
      <div className="fees-wrap">
        {isLoading && !fees && <div className="fees-loading" role="status" aria-label="Loading fees" />}
        {isError && !fees && <div className="fees-notice" role="alert">Your fees can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></div>}
        {fees && (
          <div className="fees-layout">
            <div className="fees-overview">
              <section className="fees-hero" aria-label="Fee balance">
                <span className="fees-hero-label">{fees.balance < 0 ? "In credit" : !hasBills ? "No bills yet" : fees.balance === 0 ? "All paid" : "Balance to pay"}</span>
                <strong className="fees-hero-value">{formatNaira(Math.abs(fees.balance))}</strong>
                {fees.total_billed > 0 && fees.balance > 0 && <><div className="fees-progress-label"><span>Paid so far</span><span>{formatNaira(fees.total_paid)} of {formatNaira(fees.total_billed)}</span></div><div className="fees-progress" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, (fees.total_paid / fees.total_billed) * 100))}%` }} /></div></>}
                <span className="fees-hero-note">{nextDue && fees.balance > 0 ? `Due ${formatDate(nextDue)}` : fees.balance < 0 ? "Credit available for your next bill" : fees.balance === 0 && hasBills ? "Nothing to pay right now" : "Your account is ready when needed"}</span>
              </section>
              <div className="fees-stats"><Stat label="Total billed" value={formatNaira(fees.total_billed)} /><Stat label="Paid so far" value={formatNaira(fees.total_paid)} /></div>
              {account?.state === "ISSUED" && <section className="fees-account-section"><Heading title="Pay by transfer" description="Your own account number for school fees" /><TransferAccountCard account={account} pupilName={me?.student.full_name || signedInName} title="Your account number" /></section>}
              {fees.can_pay && <div className="fees-guardian"><Info size={17} aria-hidden="true" /><p><strong>Fees are normally paid by your parent or guardian.</strong> If they can&apos;t pay through their own app right now, you can pay here. Card details are entered on the secure gateway.</p></div>}
            </div>
            <div className="fees-detail">
              <section><div className="fees-detail-top"><Heading title="School bills" description="Open a bill to see its full breakdown" first />
                {(hasBills || !!payments?.length) && <Popover.Root><Popover.Trigger asChild><button type="button" className="fees-filter-trigger" aria-label="Filter fees"><SlidersHorizontal size={18} aria-hidden="true" />{(billYear !== "all" || billStatus !== "all" || paymentYear !== "all") && <span className="fees-filter-active" aria-hidden="true" />}</button></Popover.Trigger><Popover.Portal><Popover.Content align="end" sideOffset={8} className="fees-filter-popover"><div className="fees-filter-header"><strong>Filter fees</strong><Popover.Close aria-label="Close filters">Done</Popover.Close></div><fieldset><legend>Bills</legend><label>Calendar year<span><select value={billYear} onChange={(event) => setBillYear(event.target.value)}><option value="all">All years</option>{billYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label><label>Status<span><select value={billStatus} onChange={(event) => setBillStatus(event.target.value)}><option value="all">All bills</option><option value="due">Balance due</option><option value="paid">Fully paid</option></select><ChevronDown size={15} aria-hidden="true" /></span></label></fieldset><fieldset><legend>Payment history</legend><label>Calendar year<span><select value={paymentYear} onChange={(event) => setPaymentYear(event.target.value)}><option value="all">All years</option>{paymentYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label></fieldset><button type="button" className="fees-filter-reset" onClick={() => { setBillYear("all"); setBillStatus("all"); setPaymentYear("all"); }}>Clear filters</button></Popover.Content></Popover.Portal></Popover.Root>}
              </div>
                {!hasBills ? <div className="fees-surface fees-empty">No bills yet. They will appear here when the school issues one.</div> : visibleBills.length + visibleCharges.length === 0 ? <div className="fees-surface fees-empty">No bills match these filters.</div> : <ul className="fees-invoices">{visibleBills.map((invoice, index) => <InvoiceCard key={invoice.invoice_ref} invoice={invoice} openAtFirst={index === 0} canPay={fees.can_pay && !offline} offline={offline} />)}{visibleCharges.map((charge) => <ChargeCard key={charge.note_ref} charge={charge} hasAccount={account?.state === "ISSUED"} />)}</ul>}
              </section>
              <section><Heading title="Payment history" description="Confirmed payments and transfers on their way" />
                <div className="fees-surface fees-history">{!payments || payments.length === 0 ? <p className="fees-empty">No payments yet.</p> : visiblePayments.length === 0 ? <p className="fees-empty">No payments match this year.</p> : <ul>{visiblePayments.map((payment) => <PaymentRow key={payment.reference} payment={payment} />)}</ul>}</div>
              </section>
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

/** A charge added after a bill. Card payment names one bill, so a charge is settled by transfer. */
function ChargeCard({ charge, hasAccount }: { charge: DebitNote; hasAccount: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="fees-invoice fees-surface">
      <button type="button" aria-expanded={open} aria-controls={`fees-charge-${charge.note_ref}`} onClick={() => setOpen((value) => !value)} className="fees-invoice-toggle">
        <span className="fees-invoice-title"><strong>{charge.reason || "Additional charge"}</strong><small>{["Added charge", charge.number, charge.date ? formatDate(charge.date) : null].filter(Boolean).join(" · ")}</small></span>
        <span className={cn("fees-invoice-status", charge.status === "PAID" ? "is-paid" : charge.status === "PARTIAL" ? "is-partial" : "is-due")}>{charge.status_label}</span>
        <ChevronDown className={cn("fees-invoice-chevron", open && "is-open")} size={17} aria-hidden="true" />
      </button>
      {open && <div className="fees-invoice-detail" id={`fees-charge-${charge.note_ref}`}><dl><div className="fees-invoice-line is-total"><dt>Charge</dt><dd>{formatNaira(charge.total)}</dd></div><div className="fees-invoice-line"><dt>Paid</dt><dd>{formatNaira(charge.paid)}</dd></div><div className="fees-invoice-line is-balance"><dt>Balance</dt><dd>{formatNaira(charge.balance)}</dd></div></dl>
        {charge.balance > 0 ? <p className="fees-invoice-note">{hasAccount ? "Pay this by bank transfer to your account number. Money sent there settles the oldest amount owed first." : "Ask the school office how to pay this charge."}</p> : <p className="fees-invoice-note is-paid"><Check size={16} aria-hidden="true" />This charge is fully paid. Thank you.</p>}
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
