import { timeoutSignal } from "@/lib/request-timeout";

import { accessFor } from "./access-tokens";
import { API_BASE, requestCredentials, withTenant } from "./api";
import { refreshAccess } from "./refresh";

/** What a call made as one named pupil came to: the HTTP status (0 when the school could not be reached) and the API's error code. */
export type PupilAnswer = { status: number; code: string };

const NOT_SENT: PupilAnswer = { status: 0, code: "" };

/**
 * Sends one JSON call as a particular pupil on this phone, not necessarily the
 * one showing.
 *
 * The store's requests always go as the pupil showing. A phone's push token is
 * registered for every pupil signed in on it, each under their own access
 * token, so this takes the account and uses that pupil's token: refreshed
 * first if none is held, and once more on a 401, as the store does. A pupil
 * whose sign-in cannot be renewed gets status 401 or 0 and nothing is sent.
 *
 * It carries no CSRF token and no cookie: only the store app uses it, and its
 * sign-in is a credential in secure storage.
 */
export async function pupilRequest(account: string, method: string, path: string, body: unknown): Promise<PupilAnswer> {
  const send = async (): Promise<Response> =>
    fetch(`${API_BASE}${withTenant(path)}`, {
      method,
      credentials: requestCredentials(),
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${accessFor(account)}`,
      },
      body: JSON.stringify(body ?? {}),
      signal: timeoutSignal(),
    });
  try {
    if (!accessFor(account)) {
      const outcome = await refreshAccess(account);
      if (!outcome.ok) return outcome.reason === "ended" ? { status: 401, code: "" } : NOT_SENT;
    }
    let response = await send();
    if (response.status === 401) {
      const outcome = await refreshAccess(account);
      if (!outcome.ok) return outcome.reason === "ended" ? { status: 401, code: "" } : NOT_SENT;
      response = await send();
    }
    return { status: response.status, code: await errorCode(response) };
  } catch {
    return NOT_SENT;
  }
}

/** The API's error code from a refused answer, or "" for an answer that is not one. */
async function errorCode(response: Response): Promise<string> {
  if (response.ok) return "";
  try {
    const body = (await response.json()) as { code?: string; error?: { code?: string; error_code?: string } };
    return body.error?.code ?? body.error?.error_code ?? body.code ?? "";
  } catch {
    return "";
  }
}
