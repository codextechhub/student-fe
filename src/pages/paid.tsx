import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Check, CircleAlert, Clock3, ReceiptText, X } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { feeFigures } from "@/lib/fee-figures";
import { formatNaira } from "@/lib/format";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import { useFeesQuery, usePaymentStatusQuery, usePaymentsQuery, type PaymentStatus } from "@/redux/services/portal-api";

import "./paid.css";

const POLL_EVERY_MS = 3_000;
const GIVE_UP_AFTER_MS = 3 * 60_000;

type Detail = { label: string; value: string; emphasis?: "money" | "positive" };
type Tone = "confirmed" | "pending" | "failed" | "neutral";
type Outcome = {
  chip: string;
  icon: ReactNode;
  title: string;
  text: string;
  tone: Tone;
  amount?: string;
  details: Detail[];
  note: string;
  hint: string;
  receiptRef?: number | null;
};

/** The gateway return waits for the server before claiming money was received. */
export function PaidPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const dispatch = useAppDispatch();
  const [gaveUp, setGaveUp] = useState(false);
  const [settled, setSettled] = useState(false);
  const stillAsking = !settled && !gaveUp;
  const { data: status, isError, refetch } = usePaymentStatusQuery(reference, {
    skip: !reference,
    pollingInterval: stillAsking ? POLL_EVERY_MS : 0,
    refetchOnFocus: true,
  });
  const done = status?.status === "CONFIRMED" || status?.status === "FAILED" || status?.status === "ABANDONED";
  if (done && !settled) setSettled(true);
  const { data: payments } = usePaymentsQuery(undefined, { skip: status?.status !== "CONFIRMED" });
  const { data: fees } = useFeesQuery(undefined, { skip: status?.status !== "CONFIRMED" });
  const receiptRef = payments?.find((payment) => payment.reference === reference && payment.has_receipt)?.payment_ref ?? null;

  useEffect(() => {
    const stop = window.setTimeout(() => setGaveUp(true), GIVE_UP_AFTER_MS);
    return () => window.clearTimeout(stop);
  }, [reference]);
  useEffect(() => {
    if (status?.status === "CONFIRMED") dispatch(baseApi.util.invalidateTags(["Fees", "Home"]));
  }, [status?.status, dispatch]);
  useEffect(() => {
    if (status?.status !== "CONFIRMED" || receiptRef) return;
    const again = window.setInterval(() => dispatch(baseApi.util.invalidateTags(["Fees"])), POLL_EVERY_MS);
    return () => window.clearInterval(again);
  }, [status?.status, receiptRef, dispatch]);

  const outcome = describeOutcome({ reference, status, fees: fees ? feeFigures(fees) : undefined, receiptRef, gaveUp, isError: !!isError });

  return <PageShell className="paid-page"><div className="paid-wrap">
    <h1 className="sr-only">Payment status</h1>
    <Link to="/fees" className="paid-back"><ArrowLeft size={17} aria-hidden="true" />My fees</Link>
    <div className="paid-layout">
      <section className="paid-cover" aria-labelledby="paid-outcome-title" role="status">
        <div className="paid-cover-top"><span>Payment update</span><span className="paid-status-chip">{outcome.chip}</span></div>
        <span className="paid-cover-icon" aria-hidden="true">{outcome.icon}</span>
        <h2 id="paid-outcome-title">{outcome.title}</h2>
        <p className="paid-cover-text">{outcome.text}</p>
        {outcome.amount && <p className="paid-amount"><strong>{outcome.amount}</strong><span>{status?.status === "CONFIRMED" ? "paid by card" : "card payment"}</span></p>}
      </section>
      <section className="paid-card" aria-labelledby="paid-detail-title">
        <h2 id="paid-detail-title"><ReceiptText size={19} aria-hidden="true" />Payment details</h2>
        <dl className="paid-details">
          {outcome.details.map(({ label, value, emphasis }) => <div key={label}><dt>{label}</dt><dd className={emphasis ? "is-" + emphasis : undefined}>{value}</dd></div>)}
        </dl>
        <div className={"paid-note is-" + outcome.tone} role="status">
          <CircleAlert size={18} aria-hidden="true" /><span>{outcome.note}</span>
        </div>
        <div className="paid-actions">
          {outcome.receiptRef && <Link to={"/fees/receipts/" + outcome.receiptRef} className="paid-primary">View receipt<ArrowUpRight size={17} aria-hidden="true" /></Link>}
          {isError && !status && reference && <button type="button" className="paid-primary" onClick={() => void refetch()}>Check again</button>}
          <Link to="/fees" className={outcome.receiptRef || (isError && !status && reference) ? "paid-secondary" : "paid-primary"}>Back to my fees</Link>
        </div>
        <p className="paid-hint">{outcome.hint}</p>
      </section>
    </div>
  </div></PageShell>;
}

function describeOutcome({ reference, status, fees, receiptRef, gaveUp, isError }: {
  reference: string;
  status?: PaymentStatus;
  fees?: { owing: number; credit: number };
  receiptRef: number | null;
  gaveUp: boolean;
  isError: boolean;
}): Outcome {
  if (!reference) return {
    chip: "No reference",
    icon: <Clock3 size={36} />,
    title: "Thank you",
    text: "If you made a payment, it will appear in My fees once the bank confirms it.",
    tone: "neutral",
    details: [{ label: "Status", value: "Awaiting bank confirmation" }],
    note: "We cannot check this return because it did not include a payment reference.",
    hint: "Open My fees to see the latest balance and payments.",
  };

  const details: Detail[] = [
    ...(status ? [{ label: "Amount", value: status.amount_naira, emphasis: "money" as const }] : []),
    ...(status?.status === "CONFIRMED" ? [{ label: "Paid to", value: status.payee_name }] : []),
    { label: "Reference", value: reference },
  ];

  if (!status) return {
    chip: isError ? "Check unavailable" : "Checking",
    icon: isError ? <CircleAlert size={36} /> : <Clock3 size={36} />,
    title: isError ? "Could not check yet" : "Checking your payment",
    text: isError ? "We could not get the latest payment status right now." : "We are requesting the latest status from the bank.",
    tone: "neutral",
    details: [...details, { label: "Status", value: isError ? "Check unavailable" : "Checking" }],
    note: isError ? "Try checking again, or return to My fees later." : "Please wait a moment. We will show the result here as soon as it is available.",
    hint: "You can return to My fees at any time.",
  };

  if (status.status === "CONFIRMED") {
    const balanceDetail: Detail[] = !fees ? [] : fees.owing > 0
      ? [
        { label: "New balance", value: formatNaira(fees.owing), emphasis: "money" as const },
        ...(fees.credit > 0 ? [{ label: "Credit held by the school", value: formatNaira(fees.credit), emphasis: "positive" as const }] : []),
      ]
      : [{
        label: fees.credit > 0 ? "In credit" : "New balance",
        value: formatNaira(fees.credit),
        emphasis: "positive" as const,
      }];
    const balanceLine = !fees ? "" : fees.owing > 0
      ? " Your balance is now " + formatNaira(fees.owing) + "." + (fees.credit > 0 ? " The school also holds " + formatNaira(fees.credit) + " of your credit." : "")
      : fees.credit > 0 ? " You have " + formatNaira(fees.credit) + " in credit." : " Your fees are fully paid.";
    return {
      chip: "Confirmed",
      icon: <Check size={36} />,
      title: "Payment received",
      text: "Your payment to " + status.payee_name + " has been confirmed." + balanceLine,
      amount: status.amount_naira,
      tone: receiptRef ? "confirmed" : "neutral",
      details: [...details, ...balanceDetail],
      note: receiptRef ? "Your payment is confirmed. Your receipt is ready to view." : "Your receipt is being prepared. It will appear in My fees when ready.",
      hint: receiptRef ? "A copy of your payment appears in My fees." : "Your payment is confirmed even while the receipt is being prepared.",
      receiptRef,
    };
  }

  if (status.status === "PENDING") return {
    chip: gaveUp ? "Still confirming" : "Confirming",
    icon: <Clock3 size={36} />,
    title: gaveUp ? "Still checking" : "Almost there",
    text: gaveUp ? "This is taking longer than usual. Your payment is still being checked." : "The bank has not confirmed this payment yet. This usually takes a few seconds.",
    amount: status.amount_naira,
    tone: "pending",
    details: [...details, { label: "Status", value: "Waiting for confirmation" }],
    note: gaveUp ? "Your fees will update when the bank confirms the payment. We will tell you in the app and by email." : "You can leave this page. It will not change your payment.",
    hint: gaveUp ? "Please check My fees later for the latest status." : "Your fees update after the bank confirms the payment.",
  };

  return {
    chip: "Not completed",
    icon: <X size={36} />,
    title: status.status === "ABANDONED" ? "Payment was cancelled" : "Payment did not go through",
    text: "You have not been charged, and your fees have not changed.",
    amount: status.amount_naira,
    tone: "failed",
    details: [...details, { label: "Status", value: "Not completed" }],
    note: status.status === "ABANDONED" ? "Return to My fees when you are ready to pay." : "Return to My fees to start another payment.",
    hint: status.status === "ABANDONED" ? "Your bill is still available in My fees." : "If you need help, keep this reference for the school.",
  };
}
