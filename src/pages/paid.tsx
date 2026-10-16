import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { PageShell } from "@/components/layout/page-shell";
import { formatNaira } from "@/lib/format";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/services/base-api";
import { useFeesQuery, usePaymentStatusQuery, usePaymentsQuery } from "@/redux/services/portal-api";

/** How often the page asks while the payment is still being confirmed. */
const POLL_EVERY_MS = 3_000;
/** How long it keeps asking before it settles for "we'll tell you". */
const GIVE_UP_AFTER_MS = 3 * 60_000;

/**
 * Where the card gateway sends the pupil back to: `/fees/paid?reference=...`.
 *
 * Landing here only means the gateway is done with the browser, not that money
 * moved, so the page asks the server and shows what it says: received (with
 * the receipt once it is booked and the new balance), still being confirmed
 * (asked again every few seconds, then a promise that the app and email will
 * say when it lands), or not completed (nothing was charged, try again).
 */
export function PaidPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const dispatch = useAppDispatch();
  const [gaveUp, setGaveUp] = useState(false);
  const [settled, setSettled] = useState(false);
  const stillAsking = !settled && !gaveUp;
  const { data: status } = usePaymentStatusQuery(reference, {
    skip: !reference,
    pollingInterval: stillAsking ? POLL_EVERY_MS : 0,
    refetchOnFocus: true,
  });
  const done = status?.status === "CONFIRMED" || status?.status === "FAILED" || status?.status === "ABANDONED";
  if (done && !settled) setSettled(true);
  const { data: payments } = usePaymentsQuery(undefined, { skip: status?.status !== "CONFIRMED" });
  const { data: fees } = useFeesQuery(undefined, { skip: status?.status !== "CONFIRMED" });
  const receiptRef = payments?.find((p) => p.reference === reference && p.has_receipt)?.payment_ref ?? null;

  useEffect(() => {
    const stop = window.setTimeout(() => setGaveUp(true), GIVE_UP_AFTER_MS);
    return () => window.clearTimeout(stop);
  }, []);
  useEffect(() => {
    if (status?.status === "CONFIRMED") dispatch(baseApi.util.invalidateTags(["Fees", "Home"]));
  }, [status?.status, dispatch]);
  // Booked a moment after it is confirmed: ask for the receipt until it is there.
  useEffect(() => {
    if (status?.status !== "CONFIRMED" || receiptRef) return;
    const again = window.setInterval(() => dispatch(baseApi.util.invalidateTags(["Fees"])), POLL_EVERY_MS);
    return () => window.clearInterval(again);
  }, [status?.status, receiptRef, dispatch]);

  return (
    <PageShell grid className="mx-auto w-full max-w-md content-start gap-4 pt-10 text-center lg:px-6">
      {!reference && <Body icon={<Clock className="size-10 text-muted-foreground" />} title="Thank you" text="If you made a payment, it will show on your fees once the school's bank confirms it." />}
      {reference && !status && <div className="mx-auto h-24 w-full animate-pulse rounded-xl bg-muted" />}
      {status?.status === "CONFIRMED" && (
        <Body
          icon={<CheckCircle2 className="size-10 text-green-700" />}
          title="Payment received"
          text={`${status.amount_naira} to ${status.payee_name}.${fees ? ` ${fees.balance > 0 ? `Your balance is now ${formatNaira(fees.balance)}.` : "Your fees are fully paid."}` : ""}`}
        >
          {receiptRef ? (
            <Link to={`/fees/receipts/${receiptRef}`} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              View receipt
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Your receipt is on its way.</p>
          )}
        </Body>
      )}
      {status?.status === "PENDING" && (
        <Body
          icon={<Clock className="size-10 text-amber-600" />}
          title="We're confirming your payment"
          text={
            stillAsking
              ? `${status.amount_naira}. This usually takes a few seconds. You can leave this page; it won't change your payment.`
              : `${status.amount_naira}. It is taking longer than usual. Your fees will update once the bank confirms it, and you'll be told in the app and by email.`
          }
        />
      )}
      {(status?.status === "FAILED" || status?.status === "ABANDONED") && (
        <Body
          icon={<XCircle className="size-10 text-destructive" />}
          title="Payment didn't go through"
          text={`Your payment of ${status.amount_naira} wasn't completed. You haven't been charged and your fees haven't changed.`}
        />
      )}
      <Link to="/fees" className="text-xs font-medium text-muted-foreground underline underline-offset-2">
        Back to my fees
      </Link>
    </PageShell>
  );
}

function Body({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-xl border border-border p-6">
      {icon}
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  );
}
