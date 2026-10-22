import { Check, CheckCheck, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Receipt } from "@/redux/services/messages-api";

/**
 * The ticks beside the time on the pupil's own message.
 *
 * One tick in a muted colour once the school has stored it; two in the accent
 * colour once the teacher has read it. A conversation with several readers says
 * how many in its label. Only drawn while the school shows receipts.
 */
export function Ticks({ receipt }: { receipt: Receipt }) {
  const read = receipt.state === "read";
  const label = read ? (receipt.recipient_count > 1 ? `Read by ${receipt.read_count} of ${receipt.recipient_count}` : "Read") : "Sent";
  return (
    <span className={cn("messages-ticks", read ? "is-read" : "is-sent")} role="img" aria-label={label}>
      {read ? <CheckCheck size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
    </span>
  );
}

/** The clock on a message that is still on its way to the school. */
export function SendingClock() {
  return (
    <span className="messages-ticks is-sending" role="img" aria-label="Sending">
      <Clock size={13} aria-hidden="true" />
    </span>
  );
}
