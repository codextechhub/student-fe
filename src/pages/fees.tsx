import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Info, Receipt as ReceiptIcon, SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";
import { Link } from "react-router";

import { GetTransferAccount } from "@/components/fees/get-transfer-account";
import { TransferAccountCard } from "@/components/fees/transfer-account-card";
import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import { useFeeBillsQuery, useMeQuery, usePaymentPageQuery, useTransferAccountQuery, type DebitNote, type Invoice, type PageInfo, type Payment, type TransferAccount } from "@/redux/services/portal-api";

import "./fees.css";

/**
 * School bills and payments, with only confirmed money counted as paid.
 *
 * Charges added after a bill sit in the bills list with the bills, because the
 * balance counts them: a pupil who sees a balance must be able to find every
 * amount that makes it up. The bill filters apply to both.
 */
export function FeesPage() {
  const [billPage, setBillPage] = useState(1);
  const [billYear, setBillYear] = useState("all");
  const [billStatus, setBillStatus] = useState("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentYear, setPaymentYear] = useState("all");
  const { data: fees, currentData: currentFees, isLoading, isError, refetch } = useFeeBillsQuery({ page: billPage, year: billYear, status: billStatus });
  const { data: payments, currentData: currentPayments, isError: paymentsError, refetch: refetchPayments } = usePaymentPageQuery({ page: paymentPage, year: paymentYear });
  const { data: account } = useTransferAccountQuery();
  const { data: me } = useMeQuery();
  const signedInName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.fullName);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const nextDue = fees?.next_due;
  const billYears = fees?.years ?? [];
  const paymentYears = payments?.years ?? [];
  const hasBills = fees?.has_bills ?? false;
  const visibleItems = currentFees?.items;
  const visiblePayments = currentPayments?.items;

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
              {account?.state === "NONE" && fees.balance > 0 && !offline && <section className="fees-account-section"><Heading title="Pay by transfer" description="Your own account number for school fees" /><GetTransferAccount /></section>}
              {fees.can_pay && <div className="fees-guardian"><Info size={17} aria-hidden="true" /><p><strong>Fees are normally paid by your parent or guardian.</strong> If they can&apos;t pay through their own app right now, you can pay here. Card details are entered on the secure gateway.</p></div>}
            </div>
            <div className="fees-detail">
              <section><div className="fees-detail-top"><Heading title="School bills" description="Open a bill to see its full breakdown" first />
                {(hasBills || (payments?.pagination.total ?? 0) > 0) && <Popover.Root><Popover.Trigger asChild><button type="button" className="fees-filter-trigger" aria-label="Filter fees"><SlidersHorizontal size={18} aria-hidden="true" />{(billYear !== "all" || billStatus !== "all" || paymentYear !== "all") && <span className="fees-filter-active" aria-hidden="true" />}</button></Popover.Trigger><Popover.Portal><Popover.Content align="end" sideOffset={8} className="fees-filter-popover"><div className="fees-filter-header"><strong>Filter fees</strong><Popover.Close aria-label="Close filters">Done</Popover.Close></div><fieldset><legend>Bills</legend><label>Calendar year<span><select value={billYear} onChange={(event) => { setBillYear(event.target.value); setBillPage(1); }}><option value="all">All years</option>{billYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label><label>Status<span><select value={billStatus} onChange={(event) => { setBillStatus(event.target.value); setBillPage(1); }}><option value="all">All bills</option><option value="due">Balance due</option><option value="paid">Fully paid</option></select><ChevronDown size={15} aria-hidden="true" /></span></label></fieldset><fieldset><legend>Payment history</legend><label>Calendar year<span><select value={paymentYear} onChange={(event) => { setPaymentYear(event.target.value); setPaymentPage(1); }}><option value="all">All years</option>{paymentYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label></fieldset><button type="button" className="fees-filter-reset" onClick={() => { setBillYear("all"); setBillStatus("all"); setPaymentYear("all"); setBillPage(1); setPaymentPage(1); }}>Clear filters</button></Popover.Content></Popover.Portal></Popover.Root>}
              </div>
                {!currentFees ? <div className="fees-surface fees-empty" role="status">{isError ? <>Bills can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></> : "Loading bills…"}</div> : !hasBills ? <div className="fees-surface fees-empty">No bills yet. They will appear here when the school issues one.</div> : visibleItems?.length === 0 ? <div className="fees-surface fees-empty">No bills match these filters.</div> : <ul className="fees-invoices">{visibleItems?.map((item, index) => item.kind === "invoice" ? <InvoiceCard key={`invoice-${item.invoice_ref}`} invoice={item} openAtFirst={index === 0} canPay={fees.can_pay && !offline} offline={offline} /> : <ChargeCard key={`charge-${item.note_ref}`} charge={item} openAtFirst={index === 0} transfer={account?.state} />)}</ul>}
                {currentFees && <PageControls label="School bills" page={currentFees.pagination} onChange={setBillPage} />}
              </section>
              <section><Heading title="Payment history" description="Confirmed payments and transfers on their way" />
                <div className="fees-surface fees-history">{paymentsError && !currentPayments ? <p className="fees-empty">Payments can&apos;t be shown right now. <button type="button" onClick={() => refetchPayments()}>Try again</button></p> : !currentPayments ? <p className="fees-empty" role="status">Loading payments…</p> : currentPayments.pagination.total === 0 ? <p className="fees-empty">{paymentYear === "all" ? "No payments yet." : "No payments match this year."}</p> : <ul>{visiblePayments?.map((payment) => <PaymentRow key={payment.reference} payment={payment} />)}</ul>}</div>
                {currentPayments && <PageControls label="Payment history" page={currentPayments.pagination} onChange={setPaymentPage} />}
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

function PageControls({ label, page, onChange }: { label: string; page: PageInfo; onChange: (page: number) => void }) {
  if (page.total_pages <= 1) return null;
  const pages = [...new Set([1, page.page - 1, page.page, page.page + 1, page.total_pages])]
    .filter((number) => number >= 1 && number <= page.total_pages)
    .sort((left, right) => left - right);
  return <nav className="fees-pager" aria-label={`${label} pages`}>
    <span className="fees-pager-count">{(page.page - 1) * page.page_size + 1}–{Math.min(page.page * page.page_size, page.total)} of {page.total}</span>
    <div className="fees-pager-buttons">
      <button type="button" className="fees-pager-arrow" aria-label={`Previous ${label.toLowerCase()} page`} disabled={page.page === 1} onClick={() => onChange(page.page - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
      {pages.map((number, index) => <span className="fees-pager-slot" key={number}>{index > 0 && number > pages[index - 1] + 1 && <span className="fees-pager-ellipsis" aria-hidden="true">…</span>}<button type="button" className={cn("fees-pager-number", number === page.page && "is-active")} aria-label={`${label} page ${number}`} aria-current={number === page.page ? "page" : undefined} onClick={() => onChange(number)}>{number}</button></span>)}
      <button type="button" className="fees-pager-arrow" aria-label={`Next ${label.toLowerCase()} page`} disabled={page.page === page.total_pages} onClick={() => onChange(page.page + 1)}><ChevronRight size={17} aria-hidden="true" /></button>
    </div>
  </nav>;
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

/**
 * A charge added after a bill. Card payment names one bill, so a charge is
 * settled by transfer: into the pupil's number, or one they can get under Pay
 * by transfer. Only a school that takes no transfers sends them to the office.
 */
function ChargeCard({ charge, openAtFirst, transfer }: { charge: DebitNote; openAtFirst: boolean; transfer?: TransferAccount["state"] }) {
  const [open, setOpen] = useState(openAtFirst);
  return (
    <li className="fees-invoice fees-surface">
      <button type="button" aria-expanded={open} aria-controls={`fees-charge-${charge.note_ref}`} onClick={() => setOpen((value) => !value)} className="fees-invoice-toggle">
        <span className="fees-invoice-title"><strong>{charge.reason || "Additional charge"}</strong><small>{["Added charge", charge.number, charge.date ? formatDate(charge.date) : null].filter(Boolean).join(" · ")}</small></span>
        <span className={cn("fees-invoice-status", charge.status === "PAID" ? "is-paid" : charge.status === "PARTIAL" ? "is-partial" : "is-due")}>{charge.status_label}</span>
        <ChevronDown className={cn("fees-invoice-chevron", open && "is-open")} size={17} aria-hidden="true" />
      </button>
      {open && <div className="fees-invoice-detail" id={`fees-charge-${charge.note_ref}`}><dl><div className="fees-invoice-line is-total"><dt>Charge</dt><dd>{formatNaira(charge.total)}</dd></div><div className="fees-invoice-line"><dt>Paid</dt><dd>{formatNaira(charge.paid)}</dd></div><div className="fees-invoice-line is-balance"><dt>Balance</dt><dd>{formatNaira(charge.balance)}</dd></div></dl>
        {charge.balance > 0 ? <p className="fees-invoice-note">{transfer === "ISSUED" ? "Pay this by bank transfer to your account number. Money sent there settles the oldest amount owed first." : transfer === "NONE" ? "Pay this by bank transfer. Get your account number under Pay by transfer, then send the money there." : "Ask the school office how to pay this charge."}</p> : <p className="fees-invoice-note is-paid"><Check size={16} aria-hidden="true" />This charge is fully paid. Thank you.</p>}
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
