const baseUrl = import.meta.env.VITE_BACKEND_URL;
// A deployment that shares a parent domain with its twin names its own CSRF
// cookie; this matches the backend's CSRF_COOKIE_NAME.
const csrfCookieName = import.meta.env.VITE_CSRF_COOKIE_NAME || "csrftoken";
let cachedCsrfToken = "";

function readCookie(name: string): string {
  const prefix = `${encodeURIComponent(name)}=`;
  const pair = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : "";
}

export function readCsrfToken(): string {
  return readCookie(csrfCookieName) || cachedCsrfToken;
}

/** Ensure browser-auth mutations can send Django's double-submit CSRF token. */
export async function getCsrfToken(): Promise<string> {
  const existing = readCsrfToken();
  if (existing) return existing;

  try {
    const response = await fetch(`${baseUrl}/user/auth/csrf/`, {
      method: "GET",
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return "";
    const data = await response.json() as { data?: { csrf_token?: string } };
    cachedCsrfToken = readCookie(csrfCookieName) || data?.data?.csrf_token || "";
  } catch {
    return "";
  }
  return readCsrfToken();
}
