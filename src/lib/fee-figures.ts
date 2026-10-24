/**
 * The two fee figures a pupil sees: what is owed and what the school holds.
 *
 * Owing is open bills and charges and credit is kept apart from it, so a credit
 * never hides a bill that is still unpaid. A copy of the fees saved before the
 * school sent both figures carries only `balance` (owing less credit), which
 * is read as owing when positive and as credit when negative.
 */
export function feeFigures(fees: { balance: number; owing?: number; credit?: number }): { owing: number; credit: number } {
  return {
    owing: fees.owing ?? Math.max(0, fees.balance),
    credit: fees.credit ?? Math.max(0, -fees.balance),
  };
}
