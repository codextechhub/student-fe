import { Link } from "react-router";

import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useDepositWatch } from "./use-deposit-watch";

/**
 * What the account number has received since the screen opened.
 *
 * A transfer reads "On its way" until the school has booked it, then
 * "Received" with a link to its receipt. Nothing here names a payment method:
 * the money came in by transfer, whatever the school's card setting. With
 * nothing yet it is silent, or says it is waiting when `waiting` is set.
 */
export function TransferActivity({ since, waiting = false }: { since: string; waiting?: boolean }) {
  const { deposits } = useDepositWatch(since);

  if (deposits.length === 0) {
    return waiting ? (
      <section className="transfer-activity" aria-label="Transfer activity">
        <p className="transfer-activity-waiting" role="status">Waiting for your transfer. Keep this page open to see it arrive.</p>
      </section>
    ) : null;
  }

  return (
    <section className="transfer-activity" aria-label="Transfer activity">
      <ul role="status" aria-live="polite">
        {[...deposits].reverse().map((deposit) => {
          const received = deposit.status === "CONFIRMED";
          return (
            <li key={deposit.reference} className={cn("transfer-activity-item", received ? "is-received" : "is-pending")}>
              <strong>{received ? "Received" : "On its way"}: {formatNaira(deposit.amount)}</strong>
              {received && deposit.has_receipt && deposit.payment_ref && (
                <Link to={`/fees/receipts/${deposit.payment_ref}`}>View receipt</Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
