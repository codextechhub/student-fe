import { currentSchoolSlug } from "@/utils/school-host";

import { getCsrfToken } from "./csrf";

/** The API base: `/v1` in development (proxied), absolute in a build. */
export const API_BASE = import.meta.env.VITE_BACKEND_URL;

/** What the API says went wrong: its code (either key it uses) and its sentence. */
export type ApiRefusal = { status: number; code: string; message: string };

/**
 * A browser-auth call: cookies included, the CSRF token sent, a JSON body.
 *
 * Used for signing in, refreshing, signing out and the hand-over, which run
 * outside the store because they decide which pupil the store is for. A network
 * failure answers status 0, so a caller can tell "the school is unreachable"
 * from "the school said no".
 */
export async function authPost<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; refusal: ApiRefusal }> {
  const csrf = await getCsrfToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        ...(csrf ? { "X-CSRFToken": csrf } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, refusal: { status: 0, code: "NETWORK", message: "" } };
  }
  let payload: { data?: T; message?: string; error?: { code?: string; error_code?: string } } = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (response.ok && payload.data !== undefined) return { ok: true, data: payload.data };
  return {
    ok: false,
    refusal: {
      status: response.status,
      code: payload.error?.code ?? payload.error?.error_code ?? "",
      message: payload.message ?? "",
    },
  };
}

/** `path` with this school's `?tenant=` added, as every signed-in route expects. */
export function withTenant(path: string): string {
  const slug = currentSchoolSlug();
  if (!slug || /[?&]tenant=/.test(path)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}tenant=${encodeURIComponent(slug)}`;
}

/**
 * A file address as the API serves it.
 *
 * The API answers a stored file (a crest, a photograph) as `/media/...`, a
 * path on its own host, which is not this app's host in a build. A path is
 * therefore read against the API's origin, and a full address is kept.
 */
export function apiAddress(url: string): string {
  const api = new URL(API_BASE || "/", window.location.origin);
  return new URL(url, api.origin).href;
}

/** Whether `url` is a file the API stores, which it serves only to a signed-in reader. */
export function isStoredFile(url: string): boolean {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return false;
  return new URL(apiAddress(url)).pathname.startsWith("/media/");
}
