/**
 * Where a tapped notification leads.
 *
 * The API attaches `url` (a path on the school's host, under `/student`, such
 * as `/student/messages/41`) and, on a phone shared by several pupils,
 * `account`, the pupil's device-session key. The store app's router has no
 * `/student` prefix, so the prefix comes off. Anything that is not a path
 * inside the student app opens the home screen instead: a notification must
 * never send the app to another site or another part of the school's website.
 */
export type TapTarget = { account: string; path: string };

const PREFIX = "/student";

export function tapTarget(data: Record<string, unknown>): TapTarget {
  const account = typeof data.account === "string" ? data.account.trim() : "";
  const url = typeof data.url === "string" ? data.url.trim() : "";
  return { account, path: appPath(url) };
}

/** `/student/results?x=1` as the router's own path, `/results?x=1`; "/" for anything else. */
export function appPath(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return "/";
  if (url !== PREFIX && !url.startsWith(`${PREFIX}/`) && !url.startsWith(`${PREFIX}?`) && !url.startsWith(`${PREFIX}#`)) {
    return "/";
  }
  const rest = url.slice(PREFIX.length);
  if (!rest || rest.startsWith("?") || rest.startsWith("#")) return `/${rest}`;
  return rest;
}
