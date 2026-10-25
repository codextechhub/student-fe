/**
 * The school's choice about card payments, and how a refusal of one reads.
 *
 * Card is a per-school setting that is off by default. When it is off the
 * family pays only by bank transfer into the pupil's own account number, and
 * the API answers a card checkout with a 409 `CARD_PAYMENTS_OFF`. An answer
 * that does not carry the setting at all (saved before the school sent it)
 * reads as card on, which is how the app behaved before the setting existed.
 */

/** Whether the school takes card payments. Only an explicit `false` turns card off. */
export function cardPaymentsOn(fees: { card_payments?: boolean }): boolean {
  return fees.card_payments !== false;
}

/** Whether a failed write is the API saying the school no longer takes card payments. */
export function isCardPaymentsOff(error: unknown): boolean {
  const failure = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
  return failure?.status === 409 && failure.data?.error?.code === "CARD_PAYMENTS_OFF";
}
