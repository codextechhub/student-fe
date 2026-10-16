/**
 * The iPhone home-screen icon: the school's crest where it has one.
 *
 * iOS ignores the manifest's icons and reads `<link rel="apple-touch-icon">`
 * when somebody adds the app to the home screen. The backend draws a 180px
 * icon from the school's crest beside the manifest's icons, but only for a
 * school that has a crest (it answers 404 otherwise). A school's manifest
 * points its icons at the backend (absolute addresses) exactly when there is a
 * crest; without one they are this app's own XVS icons, and the static link in
 * `index.html` stays.
 */
type Manifest = { icons?: { src?: string }[] };

/** The crest's touch icon for this manifest, or "" to keep the XVS one. */
export function touchIconFrom(manifest: Manifest): string {
  const src = manifest.icons?.[0]?.src ?? "";
  if (!/^https?:\/\//.test(src)) return "";
  return src.replace(/[^/]+$/, "apple-touch-icon.png");
}

/** Reads this school's manifest and points the touch icon at its crest when it has one. */
export async function applySchoolTouchIcon(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}manifest.webmanifest`);
    if (!response.ok) return;
    const href = touchIconFrom((await response.json()) as Manifest);
    const link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (href && link) link.href = href;
  } catch {
    // No manifest to read: the XVS icon stays.
  }
}
