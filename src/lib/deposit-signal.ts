/**
 * "Look for a transfer now": the nudge that makes the Fees and Pay screens
 * check for a deposit straight away instead of waiting for their next poll.
 *
 * It is raised when a "Payment received" push arrives while the app is in
 * front (the service worker tells the page on the web; the phone's
 * messaging plugin tells it in the store app) and when the store app returns
 * to the foreground. A screen that watches for deposits subscribes while it is
 * mounted; with none mounted the nudge goes nowhere.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Runs `listener` on every nudge until the returned function is called. */
export function onDepositCheck(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Asks every watching screen to check for a deposit now. */
export function requestDepositCheck(): void {
  for (const listener of [...listeners]) listener();
}

/** The kind the school gives a booked transfer's push. */
export const PAYMENT_RECEIVED_TAG = "billing.payment_received";

/**
 * Whether a push's data is "Payment received": its kind says so, or the
 * screen it opens is one of the pupil's receipts.
 */
export function isPaymentPush(data: { tag?: unknown; url?: unknown } | null | undefined): boolean {
  if (!data) return false;
  if (data.tag === PAYMENT_RECEIVED_TAG) return true;
  return typeof data.url === "string" && /^\/student\/fees\/receipts\/\d+(?:[?#]|$)/.test(data.url);
}
