/**
 * The token that makes a retried send safe.
 *
 * Every message carries a `client_token`. The school stores the first message
 * it sees for a token and answers a repeat with that same message, so a double
 * tap, or a retry after a dropped connection, never sends the text twice. The
 * token therefore belongs to the text: it is reused while the pupil retries the
 * same words and replaced as soon as the words change.
 */

/** A random UUID, from `crypto.randomUUID` where the browser has it. */
export function newClientToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The last send tried: the words it carried and the token it used. */
export type SendAttempt = { key: string; token: string };

/**
 * The attempt for sending `key` now.
 *
 * `key` is the text (with whatever else identifies the send, such as the
 * teacher a first message goes to). The previous attempt is returned as it is
 * when it was for the same `key`, so a retry reuses its token; otherwise a new
 * attempt starts with a fresh token.
 */
export function attemptFor(previous: SendAttempt | null, key: string, make: () => string = newClientToken): SendAttempt {
  return previous && previous.key === key ? previous : { key, token: make() };
}
