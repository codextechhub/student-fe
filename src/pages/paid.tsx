import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { formatNaira } from "@/lib/format";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import { useFeesQuery, usePaymentStatusQuery, usePaymentsQuery } from "@/redux/services/portal-api";

import "./pay.css";

const POLL_EVERY_MS = 3_000;
const GIVE_UP_AFTER_MS = 3 * 60_000;

/** The gateway return waits for the server before claiming money was received. */
export function PaidPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const dispatch = useAppDispatch();
  const [gaveUp, setGaveUp] = useState(false);
  const [settled, setSettled] = useState(false);
  const stillAsking = !settled && !gaveUp;
  const { data: status } = usePaymentStatusQuery(reference, { skip: !reference, pollingInterval: stillAsking ? POLL_EVERY_MS : 0, refetchOnFocus: true });
  const done = status?.status === "CONFIRMED" || status?.status === "FAILED" || status?.status === "ABANDONED";
  if (done && !settled) setSettled(true);
  const { data: payments } = usePaymentsQuery(undefined, { skip: status?.status !== "CONFIRMED" });
  const { data: fees } = useFeesQuery(undefined, { skip: status?.status !== "CONFIRMED" });
  const receiptRef = payments?.find((payment) => payment.reference === reference && payment.has_receipt)?.payment_ref ?? null;

  useEffect(() => { const stop = window.setTimeout(() => setGaveUp(true), GIVE_UP_AFTER_MS); return () => window.clearTimeout(stop); }, []);
  useEffect(() => { if (status?.status === "CONFIRMED") dispatch(baseApi.util.invalidateTags(["Fees", "Home"])); }, [status?.status, dispatch]);
  useEffect(() => {
    if (status?.status !== "CONFIRMED" || receiptRef) return;
    const again = window.setInterval(() => dispatch(baseApi.util.invalidateTags(["Fees"])), POLL_EVERY_MS);
    return () => window.clearInterval(again);
  }, [status?.status, receiptRef, dispatch]);

  return <PageShell className="paid-page"><div className="paid-wrap">
    {!reference && <Body icon={<Clock size={30} />} tone="pending" title="Thank you" text="If you made a payment, it will show on your fees once the school's bank confirms it." />}
    {reference && !status && <div className="pay-loading" role="status" aria-label="Checking payment" />}
    {status?.status === "CONFIRMED" && <Body icon={<CheckCircle2 size={30} />} tone="received" title="Payment received" text={`${status.amount_naira} to ${status.payee_name}.${fees ? ` ${fees.balance > 0 ? `Your balance is now ${formatNaira(fees.balance)}.` : fees.balance < 0 ? `You have ${formatNaira(-fees.balance)} in credit.` : "Your fees are fully paid."}` : ""}`} details={[{ label: "Amount", value: status.amount_naira }, { label: "Paid to", value: status.payee_name }, ...(fees ? [{ label: fees.balance < 0 ? "In credit" : "New balance", value: formatNaira(Math.abs(fees.balance)) }] : [])]}>
      {receiptRef ? <Link to={`/fees/receipts/${receiptRef}`} className="paid-action">View receipt</Link> : <p className="paid-receipt-wait">Your receipt is on its way.</p>}
    </Body>}
    {status?.status === "PENDING" && <Body icon={<Clock size={30} />} tone="pending" title="We're confirming your payment" text={stillAsking ? `${status.amount_naira}. This usually takes a few seconds. You can leave this page; it won't change your payment.` : `${status.amount_naira}. It is taking longer than usual. Your fees will update once the bank confirms it, and you'll be told in the app and by email.`} details={[{ label: "Amount", value: status.amount_naira }, { label: "Status", value: "Waiting for confirmation" }]} />}
    {(status?.status === "FAILED" || status?.status === "ABANDONED") && <Body icon={<XCircle size={30} />} tone="failed" title="Payment didn't go through" text={`Your payment of ${status.amount_naira} wasn't completed. You haven't been charged and your fees haven't changed.`} details={[{ label: "Amount", value: status.amount_naira }, { label: "Status", value: "Not completed" }]} />}
    <Link to="/fees" className="paid-secondary">Back to my fees</Link>
  </div></PageShell>;
}

function Body({ icon, tone, title, text, details, children }: { icon: React.ReactNode; tone: "received" | "pending" | "failed"; title: string; text: string; details?: { label: string; value: string }[]; children?: React.ReactNode }) {
  return <section className="paid-outcome"><span className={`paid-icon is-${tone}`}>{icon}</span><h1>{title}</h1><p>{text}</p>{details && <dl className="paid-detail">{details.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}{children}</section>;
}
