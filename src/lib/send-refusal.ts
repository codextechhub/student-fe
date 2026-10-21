import { refusal } from "@/redux/services/portal-api";

/** Said when the send limit is reached and the server sent no sentence of its own. */
export const SENDING_TOO_FAST = "You are sending messages too quickly. Wait a moment and try again.";

/**
 * The sentence for a send or a start the school refused.
 *
 * The school words its own refusals, the send limit among them (429,
 * `MESSAGE_RATE_LIMITED`), and that sentence is shown as it stands. A 429 with
 * no sentence of its own gets the same wording here, so a pupil is told to
 * wait rather than that the message could not be saved. The words and their
 * token are untouched either way: the box keeps both when a send fails, so the
 * next tap sends the same words once.
 */
export function sendRefusalMessage(error: unknown): string {
  const failed = error as { status?: unknown; data?: { message?: unknown } } | undefined;
  const said = typeof failed?.data?.message === "string" && failed.data.message.trim() !== "";
  if (failed?.status === 429 && !said) return SENDING_TOO_FAST;
  return refusal(error).message;
}
