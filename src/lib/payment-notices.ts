/**
 * Where a "payment received" notice from the school opens.
 *
 * The notice is the school's in-app row for the event `billing.payment_received`.
 * Its `action_url` names this app's own receipt (`/student/fees/receipts/<payment id>`),
 * which the router knows without the app prefix. A row without one, or with
 * an address that is not a receipt in this app, opens Fees, where every
 * payment is listed.
 */

/** The event key of a booked payment's notice. */
export const PAYMENT_RECEIVED_EVENT = "billing.payment_received";

const RECEIPT_URL = /^\/student\/fees\/receipts\/(\d+)\/?$/;

/** The router path a notice opens: its receipt, or Fees when the address is not one. */
export function noticePath(actionUrl: string | undefined): string {
  const id = RECEIPT_URL.exec(actionUrl ?? "")?.[1];
  return id ? `/fees/receipts/${id}` : "/fees";
}

const AMOUNT_FIRST = /^\s*(₦\s?[\d,]+(?:\.\d+)?)/;

/**
 * The amount a notice leads with.
 *
 * The school's subject reads "₦500.00 received from Tunde Bello": the amount
 * is what a pupil looks for, so Home sets it large. A subject that does not
 * start with an amount is shown whole, as the headline, and nothing is guessed.
 */
export function noticeHeadline(subject: string): string {
  const text = subject.trim();
  return AMOUNT_FIRST.exec(text)?.[1].replace(/\s+/g, "") ?? (text || "Payment received");
}

/** What a notice opens, in words: the receipt it names, or Fees when it names none. */
export function noticeActionLabel(actionUrl: string | undefined): string {
  return RECEIPT_URL.test(actionUrl ?? "") ? "View receipt" : "View fees";
}
