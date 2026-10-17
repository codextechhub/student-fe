import { currentSchoolSlug } from "@/utils/school-host";

/**
 * The installed app's name and icons: the school's own, where it has them.
 *
 * The backend serves each school's manifest (its name, and icons cut from its
 * crest) at `/v1/portal/student/app/<slug>/manifest.webmanifest`. The app asks
 * for it on its own address, `/student/app/<slug>/manifest.webmanifest`, which
 * the host passes through to the API. The school is named in the path because
 * a static host's rules cannot read which school's address was asked for.
 * When that manifest arrives, the page's manifest link is pointed at it;
 * until then, or when it cannot be had, the XVS manifest in `index.html`
 * stays, so the app can always be installed.
 *
 * iOS ignores the manifest's icons and reads `<link rel="apple-touch-icon">`
 * when somebody adds the app to the Home Screen. The backend draws a 180px
 * icon from the crest beside the manifest's icons, only for a school that has
 * a crest; a school without one lists this app's own XVS icons under
 * `/student/icons/`, and the XVS touch icon stays.
 */
type Manifest = { name?: string; short_name?: string; icons?: { src?: string }[] };

let appName = "";
const nameListeners = new Set<() => void>();

/** The name under the school's icon (its short name, else its name), or "" before its manifest is read. */
export function schoolAppName(): string {
  return appName;
}

export function subscribeSchoolAppName(listener: () => void): () => void {
  nameListeners.add(listener);
  return () => nameListeners.delete(listener);
}

/** Where this school's manifest is asked for, or "" on an address that names no school. */
export function schoolManifestUrl(slug: string = currentSchoolSlug()): string {
  return slug ? `${import.meta.env.BASE_URL}app/${encodeURIComponent(slug)}/manifest.webmanifest` : "";
}

/** The crest's touch icon for a manifest read from `manifestUrl`, or "" to keep the XVS one. */
export function touchIconFrom(manifest: Manifest, manifestUrl: string): string {
  const src = manifest.icons?.[0]?.src ?? "";
  if (!src) return "";
  const icon = new URL(src, new URL(manifestUrl, "http://app.invalid"));
  if (icon.pathname.startsWith("/student/icons/")) return "";
  const resolved = icon.origin === "http://app.invalid" ? icon.pathname : icon.href;
  return resolved.replace(/[^/]+$/, "apple-touch-icon.png");
}

/** Points the page's manifest and touch icon at this school's own, when it has them, and keeps its name. */
export async function applySchoolApp(): Promise<void> {
  const url = schoolManifestUrl();
  if (!url) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const manifest = (await response.json()) as Manifest;
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink) manifestLink.href = url;
    const touch = touchIconFrom(manifest, url);
    const touchLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (touch && touchLink) touchLink.href = touch;
    appName = (manifest.short_name || manifest.name || "").trim();
    for (const listener of nameListeners) listener();
  } catch {
    // No school manifest to read: the XVS one stays.
  }
}
