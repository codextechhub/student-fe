/**
 * How a "payment received" notice from the school reads on the home screen.
 *
 * The notice is the school's in-app row for the event `billing.payment_received`.
 * The feed carries its subject ("₦500.00 received from Tunde Bello"), its body
 * ("Receipt RCP-0007, 25 Oct 2026, applied to INV-0012.") and its time, and
 * names no payment, so the receipt is found by its number among the pupil's
 * payments the app already reads. A notice whose receipt cannot be found yet
 * still opens Fees, where every payment is listed. The pupil is the payer's
 * subject, so the notice does not repeat their name.
 */

/** The event key of a booked payment's notice. */
export const PAYMENT_RECEIVED_EVENT = "billing.payment_received";

/** The part of a payment a notice names. `receipt_number` is what ties it to a payment. */
type PaymentLike = { payment_ref: number | null; receipt_number: string };

export type NoticeLine = {
  /** "Payment received, ₦500.00", or the school's own subject when it does not parse. */
  title: string;
  /** The receipt number the notice names, or "". */
  receiptNumber: string;
  /** Where the notice opens: the receipt when it is found, else Fees. */
  href: string;
};

const SUBJECT = /^(₦\s?[\d,]+(?:\.\d+)?) received from /;
const RECEIPT = /^Receipt\s+([^,]+),/;

/**
 * Words and destination for one notice.
 *
 * `payments` is the pupil's payments, or undefined while they are still being
 * read.
 */
export function describeNotice(
  notice: { subject: string; body: string },
  payments: PaymentLike[] | undefined,
): NoticeLine {
  const receiptNumber = RECEIPT.exec(notice.body)?.[1]?.trim() ?? "";
  const match = receiptNumber
    ? payments?.find((p) => p.receipt_number === receiptNumber && p.payment_ref != null)
    : undefined;
  const amount = SUBJECT.exec(notice.subject)?.[1];
  return {
    title: amount ? `Payment received, ${amount}` : notice.subject || "Payment received",
    receiptNumber,
    href: match ? `/fees/receipts/${match.payment_ref}` : "/fees",
  };
}
