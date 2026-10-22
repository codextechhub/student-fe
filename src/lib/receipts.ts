import type { Receipt } from "@/redux/services/messages-api";

/**
 * The better of two receipts for one message: a message never goes from read
 * back to sent, so a late answer carrying an older state cannot undo a tick.
 */
export function betterReceipt(held: Receipt | undefined, next: Receipt | undefined): Receipt | undefined {
  if (!held) return next;
  if (!next) return held;
  if (next.read_count !== held.read_count) return next.read_count > held.read_count ? next : held;
  return next.state === "read" && held.state !== "read" ? next : held;
}
