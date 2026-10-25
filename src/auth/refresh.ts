import { getCredential, putCredential } from "@/native/credentials";
import { isNativeApp } from "@/native/platform";

import { setAccess, dropAccess } from "./access-tokens";
import { authPost } from "./api";
import { forgetCredential } from "./device-credential";

/**
 * What a refresh came to.
 *
 * - `ok`: a new access token, now held for the pupil.
 * - `ended`: the pupil's sign-in on this phone is over (expired, revoked by the
 *   school, or no longer valid) and the API has cleared its cookie. The pupil
 *   comes off the phone.
 * - `offline` / `server`: nothing was decided; the pupil stays and the app says
 *   it cannot reach the school.
 */
export type RefreshOutcome =
  | { ok: true; access: string }
  | { ok: false; reason: "ended" | "offline" | "server" };

const ENDED = new Set(["TOKEN_EXPIRED", "TOKEN_REVOKED", "TOKEN_INVALID"]);

/** How long the loser of a race waits before asking again, for the winner's cookie to land. */
const STALE_RETRY_MS = 250;

const inFlight = new Map<string, Promise<RefreshOutcome>>();

/**
 * A fresh access token for one pupil, one refresh at a time.
 *
 * The API rotates a pupil's credential on every refresh, and a second refresh
 * that presents the credential just rotated away is answered 409 `TOKEN_STALE`.
 * So refreshes for one pupil are serialised twice over: callers in this tab
 * share one promise, and every tab and window of the app (an installed app and
 * a browser tab on the same phone) queue on a Web Lock named for the pupil.
 * Inside the lock a 409 is retried once, by which time the other window's new
 * cookie is in the browser's jar.
 *
 * Different pupils never wait on each other.
 *
 * In the store app there is no cookie: the pupil's credential is read from the
 * phone's secure storage, sent in the body, and the rotated one the API
 * answers with is stored in its place. A pupil with no credential stored has
 * nothing to refresh with, so their sign-in is over. A storage that cannot be
 * read decides nothing, as an unreachable school decides nothing.
 */
export function refreshAccess(account: string): Promise<RefreshOutcome> {
  const running = inFlight.get(account);
  if (running) return running;
  const attempt = withAccountLock(account, () => refreshOnce(account, true)).finally(() => {
    inFlight.delete(account);
  });
  inFlight.set(account, attempt);
  return attempt;
}

function withAccountLock<T>(account: string, task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return task();
  return locks.request(`refresh:${account}`, task) as unknown as Promise<T>;
}

/** What a refresh sends: the account, and in the store app the credential kept for it. */
async function refreshBody(account: string): Promise<{ account: string; refresh?: string } | "none" | "unreadable"> {
  if (!isNativeApp()) return { account };
  try {
    const refresh = await getCredential(account);
    return refresh ? { account, refresh } : "none";
  } catch {
    return "unreadable";
  }
}

async function refreshOnce(account: string, mayRetry: boolean): Promise<RefreshOutcome> {
  const body = await refreshBody(account);
  if (body === "unreadable") return { ok: false, reason: "server" };
  if (body === "none") {
    dropAccess(account);
    return { ok: false, reason: "ended" };
  }
  const result = await authPost<{ access?: string; refresh?: string }>("/user/auth/device/refresh/", body);
  if (result.ok) {
    const access = result.data.access ?? "";
    if (!access) return { ok: false, reason: "server" };
    if (isNativeApp()) {
      if (!result.data.refresh) return { ok: false, reason: "server" };
      try {
        await putCredential(account, result.data.refresh);
      } catch {
        // Not kept: this launch carries on with its access token, and the next one asks for a sign-in.
      }
    }
    setAccess(account, access);
    return { ok: true, access };
  }
  const { status, code } = result.refusal;
  if (status === 409 && code === "TOKEN_STALE") {
    if (!mayRetry) return { ok: false, reason: "server" };
    await new Promise((resolve) => setTimeout(resolve, STALE_RETRY_MS));
    return refreshOnce(account, false);
  }
  if (status === 401 && (ENDED.has(code) || !code)) {
    dropAccess(account);
    await forgetCredential(account);
    return { ok: false, reason: "ended" };
  }
  if (status === 0) return { ok: false, reason: "offline" };
  return { ok: false, reason: "server" };
}
