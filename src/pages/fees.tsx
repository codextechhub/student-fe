import { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, Info, Plus, Receipt as ReceiptIcon, SlidersHorizontal } from "lucide-react";
import { Popover } from "radix-ui";
import { Link } from "react-router";

import { GetTransferAccount } from "@/components/fees/get-transfer-account";
import { TransferAccountCard } from "@/components/fees/transfer-account-card";
import { PageShell } from "@/components/layout/page-shell";
import { feeFigures } from "@/lib/fee-figures";
import { formatDate, formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import {
  useFeeBillsQuery, useMeQuery, usePaymentPageQuery, useTransferAccountQuery,
  type DebitNote, type Invoice, type PageInfo, type Payment, type TransferAccount,
} from "@/redux/services/portal-api";

import "./fees.css";

/** One balance, a short bill list, and supporting information on demand. */
export function FeesPage() {
  const [billPage, setBillPage] = useState(1);
  const [billYear, setBillYear] = useState("all");
  const [billStatus, setBillStatus] = useState("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentYear, setPaymentYear] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const { data: fees, currentData: currentFees, isLoading, isError, refetch } =
    useFeeBillsQuery({ page: billPage, year: billYear, status: billStatus });
  const { data: payments, currentData: currentPayments, isError: paymentsError, refetch: refetchPayments } =
    usePaymentPageQuery({ page: paymentPage, year: paymentYear });
  const { data: account } = useTransferAccountQuery();
  const { data: me } = useMeQuery();
  const signedInName = useAppSelector((s) => s.session.pupils.find((p) => p.account === s.session.active)?.fullName);
  const offline = useAppSelector((s) => s.connectivity.offline);
  const billYears = fees?.years ?? [];
  const paymentYears = payments?.years ?? [];
  const hasBills = fees?.has_bills ?? false;
  const { owing, credit } = fees ? feeFigures(fees) : { owing: 0, credit: 0 };
  const canShowTransfer = account?.state === "ISSUED" || (account?.state === "NONE" && !!fees && owing > 0 && !offline);
  const filterActive = billYear !== "all" || billStatus !== "all" || paymentYear !== "all";

  return (
    <PageShell className="fees-page">
      <div className="fees-wrap">
        {isLoading && !fees && <div className="fees-loading" role="status" aria-label="Loading fees" />}
        {isError && !fees && <div className="fees-notice" role="alert">Your fees can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></div>}
        {fees && (
          <div className="fees-layout fees-simple-layout">
            <section className="fees-hero fees-simple-hero" aria-label="Fee balance">
              <div>
                <span className="fees-hero-label">{owing > 0 ? "Balance to pay" : credit > 0 ? "In credit" : hasBills ? "All paid" : "No bills yet"}</span>
                <strong className="fees-hero-value">{formatNaira(owing > 0 ? owing : credit)}</strong>
                <p className="fees-simple-due">{owing > 0 ? (fees.next_due ? "Next bill due " + formatDate(fees.next_due) : "Open bills and charges on your account") : credit > 0 ? "Credit available for your next bill" : hasBills ? "Nothing to pay right now" : "Your account is ready when needed"}</p>
                {owing > 0 && credit > 0 && <p className="fees-hero-credit">{formatNaira(credit)} credit held by the school. Ask the school to apply it before you pay.</p>}
              </div>
              {hasBills && <div className="fees-simple-hero-note"><strong>Your school account</strong><span>See school bills and added charges below</span></div>}
            </section>

            {fees.can_pay && <div className="fees-guardian"><Info size={17} aria-hidden="true" /><p><strong>Your parent or guardian usually pays school fees.</strong> If they can&apos;t pay in their app right now, you can pay a bill here.</p></div>}

            <section aria-labelledby="fees-bills-heading">
              <div className="fees-detail-top fees-simple-detail-top">
                <div className="fees-section-heading"><h2 id="fees-bills-heading">{owing > 0 ? "What you owe" : "School bills"}</h2><p>Open an item for details</p></div>
                {(hasBills || (payments?.pagination.total ?? 0) > 0) && (
                  <Popover.Root>
                    <Popover.Trigger asChild><button type="button" className="fees-filter-trigger" aria-label="Filter fees"><SlidersHorizontal size={18} aria-hidden="true" />{filterActive && <span className="fees-filter-active" aria-hidden="true" />}</button></Popover.Trigger>
                    <Popover.Portal><Popover.Content align="end" sideOffset={8} className="fees-filter-popover">
                      <div className="fees-filter-header"><strong>Filter fees</strong><Popover.Close aria-label="Close filters">Done</Popover.Close></div>
                      <fieldset><legend>Bills</legend>
                        <label>Calendar year<span><select value={billYear} onChange={(event) => { setBillYear(event.target.value); setBillPage(1); }}><option value="all">All years</option>{billYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label>
                        <label>Status<span><select value={billStatus} onChange={(event) => { setBillStatus(event.target.value); setBillPage(1); }}><option value="all">All bills</option><option value="due">Balance due</option><option value="paid">Fully paid</option></select><ChevronDown size={15} aria-hidden="true" /></span></label>
                      </fieldset>
                      <fieldset><legend>Payment history</legend><label>Calendar year<span><select value={paymentYear} onChange={(event) => { setPaymentYear(event.target.value); setPaymentPage(1); }}><option value="all">All years</option>{paymentYears.map((year) => <option key={year} value={year}>{year}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label></fieldset>
                      <button type="button" className="fees-filter-reset" onClick={() => { setBillYear("all"); setBillStatus("all"); setPaymentYear("all"); setBillPage(1); setPaymentPage(1); }}>Clear filters</button>
                    </Popover.Content></Popover.Portal>
                  </Popover.Root>
                )}
              </div>
              {!currentFees ? <div className="fees-surface fees-empty" role="status">{isError ? <>Bills can&apos;t be shown right now. <button type="button" onClick={() => refetch()}>Try again</button></> : "Loading bills…"}</div>
                : !hasBills ? <div className="fees-surface fees-empty">No bills yet. They will appear here when the school issues one.</div>
                : currentFees.items.length === 0 ? <div className="fees-surface fees-empty">No bills match these filters.</div>
                : <ul className="fees-invoices fees-simple-items">{currentFees.items.map((item) => item.kind === "invoice"
                    ? <InvoiceCard key={"invoice-" + item.invoice_ref} invoice={item} canPay={fees.can_pay && !offline} offline={offline} />
                    : <ChargeCard key={"charge-" + item.note_ref} charge={item} transfer={account?.state} canShowTransfer={canShowTransfer} onShowTransfer={() => setTransferOpen(true)} />)}</ul>}
              {currentFees && <PageControls label="School bills" page={currentFees.pagination} onChange={setBillPage} />}
            </section>

            <div className="fees-secondary-actions">
              <DisclosureButton title="Payment history" description="Payments and receipts" open={historyOpen} controls="fees-payment-history" onClick={() => setHistoryOpen((value) => !value)} />
              {canShowTransfer && <DisclosureButton title="Bank transfer account" description="Your own account number" open={transferOpen} controls="fees-transfer-account" onClick={() => setTransferOpen((value) => !value)} />}
            </div>
            <section className="fees-secondary-panel" id="fees-payment-history" hidden={!historyOpen} aria-label="Payment history">
              {historyOpen && <>
                <h2>Payment history</h2><p>Confirmed payments and transfers on their way.</p>
                <div className="fees-history">{paymentsError && !currentPayments ? <p className="fees-empty">Payments can&apos;t be shown right now. <button type="button" onClick={() => refetchPayments()}>Try again</button></p>
                  : !currentPayments ? <p className="fees-empty" role="status">Loading payments…</p>
                  : currentPayments.pagination.total === 0 ? <p className="fees-empty">{paymentYear === "all" ? "No payments yet." : "No payments match this year."}</p>
                  : <ul>{currentPayments.items.map((payment) => <PaymentRow key={payment.reference} payment={payment} />)}</ul>}</div>
                {currentPayments && <PageControls label="Payment history" page={currentPayments.pagination} onChange={setPaymentPage} />}
              </>}
            </section>
            {canShowTransfer && <section className="fees-secondary-panel fees-account-section" id="fees-transfer-account" hidden={!transferOpen} aria-label="Bank transfer account">
              {transferOpen && <><h2>Bank transfer account</h2>
                {account?.state === "ISSUED" && <TransferAccountCard account={account} pupilName={me?.student.full_name || signedInName} title="Your account number" />}
                {account?.state === "NONE" && <GetTransferAccount />}
              </>}
            </section>}
          </div>
        )}
        {!fees && account?.state === "ISSUED" && <section className="fees-secondary-panel fees-account-section"><h2>Bank transfer account</h2><TransferAccountCard account={account} pupilName={me?.student.full_name || signedInName} title="Your account number" /></section>}
      </div>
    </PageShell>
  );
}

function DisclosureButton({ title, description, open, controls, onClick }: {
  title: string; description: string; open: boolean; controls: string; onClick: () => void;
}) {
  return <button type="button" className="fees-secondary-button" aria-expanded={open} aria-controls={controls} onClick={onClick}>
    <span><strong>{title}</strong><small>{description}</small></span><ChevronDown className={cn(open && "is-open")} size={18} aria-hidden="true" />
  </button>;
}

function PageControls({ label, page, onChange }: { label: string; page: PageInfo; onChange: (page: number) => void }) {
  if (page.total_pages <= 1) return null;
  const pages = [...new Set([1, page.page - 1, page.page, page.page + 1, page.total_pages])]
    .filter((number) => number >= 1 && number <= page.total_pages)
    .sort((left, right) => left - right);
  return <nav className="fees-pager" aria-label={label + " pages"}>
    <span className="fees-pager-count">{(page.page - 1) * page.page_size + 1}–{Math.min(page.page * page.page_size, page.total)} of {page.total}</span>
    <div className="fees-pager-buttons">
      <button type="button" className="fees-pager-arrow" aria-label={"Previous " + label.toLowerCase() + " page"} disabled={page.page === 1} onClick={() => onChange(page.page - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
      {pages.map((number, index) => <span className="fees-pager-slot" key={number}>{index > 0 && number > pages[index - 1] + 1 && <span className="fees-pager-ellipsis" aria-hidden="true">…</span>}<button type="button" className={cn("fees-pager-number", number === page.page && "is-active")} aria-label={label + " page " + number} aria-current={number === page.page ? "page" : undefined} onClick={() => onChange(number)}>{number}</button></span>)}
      <button type="button" className="fees-pager-arrow" aria-label={"Next " + label.toLowerCase() + " page"} disabled={page.page === page.total_pages} onClick={() => onChange(page.page + 1)}><ChevronRight size={17} aria-hidden="true" /></button>
    </div>
  </nav>;
}

function InvoiceCard({ invoice, canPay, offline }: { invoice: Invoice; canPay: boolean; offline: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = "fees-invoice-" + invoice.invoice_ref;
  return <li className="fees-invoice fees-surface">
    <div className="fees-bill-row">
      <span className="fees-bill-icon"><FileText size={19} aria-hidden="true" /></span>
      <div className="fees-invoice-title"><strong>{invoice.title}</strong><small>School bill · {invoice.status_label}</small></div>
      <div className={cn("fees-bill-balance", invoice.balance <= 0 && "is-clear")}><strong>{invoice.balance > 0 ? formatNaira(invoice.balance) : "All paid"}</strong><small>{invoice.balance > 0 && invoice.due_date ? "Due " + formatDate(invoice.due_date) : invoice.balance > 0 ? "Outstanding" : "Nothing due"}</small></div>
      <div className="fees-bill-actions">
        {invoice.balance > 0 && canPay && <Link className="fees-bill-pay" to={"/fees/pay/" + invoice.invoice_ref}>Pay bill</Link>}
        <button type="button" className="fees-invoice-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>Details <ChevronDown className={cn(open && "is-open")} size={15} aria-hidden="true" /></button>
      </div>
    </div>
    <div className="fees-invoice-detail" id={panelId} hidden={!open}>
      {open && <><dl>{invoice.lines.map((line, index) => <div className="fees-invoice-line" key={index}><dt>{line.description}</dt><dd>{formatNaira(line.amount)}</dd></div>)}<div className="fees-invoice-line is-total"><dt>Total billed</dt><dd>{formatNaira(invoice.total)}</dd></div><div className="fees-invoice-line"><dt>Paid</dt><dd>{formatNaira(invoice.paid)}</dd></div><div className="fees-invoice-line is-balance"><dt>Balance</dt><dd>{formatNaira(invoice.balance)}</dd></div></dl>
        {invoice.balance > 0 ? canPay ? <Link className="fees-detail-pay" to={"/fees/pay/" + invoice.invoice_ref}>Pay balance →</Link> : offline ? <p className="fees-invoice-note">You can pay when you&apos;re back online.</p> : null : <p className="fees-invoice-note is-paid"><Check size={16} aria-hidden="true" />This bill is fully paid. Thank you.</p>}
      </>}
    </div>
  </li>;
}

/** Added charges are settled by transfer, never by a bill-specific card payment. */
function ChargeCard({ charge, transfer, canShowTransfer, onShowTransfer }: {
  charge: DebitNote; transfer?: TransferAccount["state"]; canShowTransfer: boolean; onShowTransfer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = "fees-charge-" + charge.note_ref;
  return <li className="fees-invoice fees-surface fees-charge">
    <div className="fees-bill-row">
      <span className="fees-bill-icon"><Plus size={19} aria-hidden="true" /></span>
      <div className="fees-invoice-title"><strong>{charge.reason || "Additional charge"}</strong><small>Added charge · {charge.status_label}</small></div>
      <div className={cn("fees-bill-balance", charge.balance <= 0 && "is-clear")}><strong>{charge.balance > 0 ? formatNaira(charge.balance) : "All paid"}</strong><small>{charge.date ? "Added " + formatDate(charge.date) : charge.balance > 0 ? "Outstanding" : "Nothing due"}</small></div>
      <div className="fees-bill-actions"><button type="button" className="fees-invoice-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>Details <ChevronDown className={cn(open && "is-open")} size={15} aria-hidden="true" /></button></div>
    </div>
    <div className="fees-invoice-detail" id={panelId} hidden={!open}>
      {open && <><dl><div className="fees-invoice-line"><dt>Reference</dt><dd>{charge.number}</dd></div><div className="fees-invoice-line is-total"><dt>Charge</dt><dd>{formatNaira(charge.total)}</dd></div><div className="fees-invoice-line"><dt>Paid</dt><dd>{formatNaira(charge.paid)}</dd></div><div className="fees-invoice-line is-balance"><dt>Balance</dt><dd>{formatNaira(charge.balance)}</dd></div></dl>
        {charge.balance > 0 ? <>
          <p className="fees-invoice-note">{transfer === "ISSUED" ? "Pay this by bank transfer to your account number. Money sent there settles the oldest amount owed first." : transfer === "NONE" ? "Open Bank transfer account below to get your account number, then send the money there." : "Ask the school office how to pay this charge."}</p>
          {canShowTransfer && <button type="button" className="fees-transfer-reveal" onClick={onShowTransfer}>Show transfer account →</button>}
        </> : <p className="fees-invoice-note is-paid"><Check size={16} aria-hidden="true" />This charge is fully paid. Thank you.</p>}
      </>}
    </div>
  </li>;
}

function PaymentRow({ payment }: { payment: Payment }) {
  const confirmed = payment.status === "CONFIRMED";
  const by = payment.payer_name ? "by " + payment.payer_name : payment.source_label || "";
  return <li className="fees-payment">
    <span className={cn("fees-payment-icon", !confirmed && "is-pending")}>{confirmed ? <Check size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}</span>
    <div className="fees-payment-main"><strong>{formatNaira(payment.amount)}</strong><span>{[payment.paid_on ? formatDate(payment.paid_on) : null, confirmed ? payment.method_label : "Waiting for confirmation", by].filter(Boolean).join(" · ")}</span></div>
    <div className="fees-payment-side"><b className={cn(!confirmed && "is-pending")}>{payment.status_label}</b>{payment.has_receipt && payment.payment_ref ? <Link to={"/fees/receipts/" + payment.payment_ref}><ReceiptIcon size={13} aria-hidden="true" />Receipt</Link> : <small>No receipt yet</small>}</div>
  </li>;
}
