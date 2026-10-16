import { useState } from "react";
import { ChevronDown, Info, Receipt as ReceiptIcon } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { formatDate, formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import { useFeesQuery, usePaymentsQuery, type Invoice, type Payment } from "@/redux/services/portal-api";

/**
 * The pupil's fees: what was billed, what is paid, each bill with its lines,
 * and every payment with how and by whom it was made.
 *
 * Fees are normally paid by a parent or guardian, and the screen says so
 * first; a pupil pays here only where the school allows it (`can_pay`), and
 * then only a bill with something owing offers Pay. A payment the gateway has
 * not confirmed yet shows as waiting, with no receipt, and is never counted
 * as paid. A payment names who made it only where the server does, and
 * otherwise says how the money arrived (`source_label`), so a family's
 * transfer is never credited to the school. When the school's books cannot be
 * read the screen says so rather than showing a zero balance.
 */
export function FeesPage() {
  const { data: fees, isLoading, isError, refetch } = useFeesQuery();
  const { data: payments } = usePaymentsQuery();
  const offline = useAppSelector((s) => s.connectivity.offline);

  return (
    <PageShell grid className="mx-auto w-full max-w-5xl content-start gap-4 pt-4 lg:px-6">
      <PageHeader title="My fees" description="Your bills, what has been paid and every receipt." />
      {isLoading && <div className="h-48 animate-pulse rounded-xl bg-muted" />}
      {isError && !fees && (
        <p className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
          Your fees can&apos;t be shown right now.{" "}
          <button type="button" className="font-medium text-primary" onClick={() => refetch()}>
            Try again
          </button>
        </p>
      )}
      {fees && (
        <>
          {fees.can_pay && (
            <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                <span className="font-semibold">Fees are normally paid by your parent or guardian.</span> If they
                can&apos;t pay through their own app right now, you can pay here. Card details are entered on the secure
                gateway, never in this app.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Total label="Billed" value={formatNaira(fees.total_billed)} />
            <Total label="Paid so far" value={formatNaira(fees.total_paid)} />
            <Total
              label={fees.balance < 0 ? "In credit" : "Balance"}
              value={formatNaira(Math.abs(fees.balance))}
              note={fees.balance < 0 ? "Used against your next bill." : undefined}
            />
          </div>

          {fees.invoices.length === 0 ? (
            <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">No bills yet.</p>
          ) : (
            <ul className="grid gap-3">
              {fees.invoices.map((invoice, i) => (
                <InvoiceCard key={invoice.invoice_ref} invoice={invoice} openAtFirst={i === 0} canPay={fees.can_pay && !offline} offline={offline} />
              ))}
            </ul>
          )}

          <section className="min-w-0 rounded-xl border border-border p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Payment history</h2>
            {!payments || payments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((payment) => (
                  <PaymentRow key={payment.reference} payment={payment} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}

function Total({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-lg font-semibold text-foreground">{value}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PARTIAL: "bg-amber-100 text-amber-800",
};

function InvoiceCard({ invoice, openAtFirst, canPay, offline }: { invoice: Invoice; openAtFirst: boolean; canPay: boolean; offline: boolean }) {
  const [open, setOpen] = useState(openAtFirst);
  return (
    <li className="min-w-0 overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center gap-3 p-4 text-left hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{invoice.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[invoice.number, invoice.due_date ? `due ${formatDate(invoice.due_date)}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CHIP[invoice.status] ?? "bg-red-100 text-red-700")}>
          {invoice.status_label}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <dl className="space-y-1.5 text-sm">
            {invoice.lines.map((line, i) => (
              <div key={i} className="flex justify-between gap-3">
                <dt className="min-w-0 text-muted-foreground">{line.description}</dt>
                <dd className="font-mono tabular-nums">{formatNaira(line.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-medium">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">{formatNaira(invoice.total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="font-mono tabular-nums">{formatNaira(invoice.paid)}</dd>
            </div>
            <div className="flex justify-between gap-3 font-semibold">
              <dt>Balance</dt>
              <dd className="font-mono tabular-nums">{formatNaira(invoice.balance)}</dd>
            </div>
          </dl>
          {invoice.balance > 0 ? (
            canPay ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">
                  Only pay here if your parent or guardian can&apos;t pay right now.
                </p>
                <Link
                  to={`/fees/pay/${invoice.invoice_ref}`}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Pay balance
                </Link>
              </div>
            ) : offline ? (
              <p className="mt-3 text-xs text-muted-foreground">You can pay when you&apos;re back online.</p>
            ) : null
          ) : (
            <p className="mt-3 text-xs font-medium text-green-700">This bill is fully paid. Thank you.</p>
          )}
        </div>
      )}
    </li>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const confirmed = payment.status === "CONFIRMED";
  // The payer where named, else how it arrived; never a guess.
  const by = payment.payer_name ? `by ${payment.payer_name}` : (payment.source_label ? `· ${payment.source_label}` : "");
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-medium text-foreground">
          {formatNaira(payment.amount)} <span className="font-normal text-muted-foreground">{by}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[payment.paid_on ? formatDate(payment.paid_on) : null, confirmed ? payment.method_label : "Waiting for confirmation", payment.receipt_number || payment.reference]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", confirmed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
        {payment.status_label}
      </span>
      {payment.has_receipt && payment.payment_ref ? (
        <Link to={`/fees/receipts/${payment.payment_ref}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <ReceiptIcon className="size-3.5" /> Receipt
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">No receipt yet</span>
      )}
    </li>
  );
}
