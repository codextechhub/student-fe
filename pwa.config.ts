/**
 * What the service worker may keep, and what it must never touch.
 *
 * It caches the app itself (scripts, styles, fonts, the crest) so the app opens
 * with no signal, and nothing a pupil can read. Pupil data never goes through
 * the service worker's cache: one phone holds several pupils, and a cache
 * keyed by address would answer Bola's request for `results/` with Tunde's
 * results. Each pupil's offline copy is kept by the app, per pupil, and wiped
 * when that pupil signs out.
 *
 * So the API (`/v1/`) and uploaded files (`/media/`) are excluded from the
 * navigation fallback and given no runtime caching rule at all, and the
 * fallback page is the app's own `index.html` under `/student/`, never a page
 * of school-fe's, which shares the origin.
 */
export const workboxOptions = {
  globPatterns: ["**/*.{js,css,html,svg,png,woff2,webmanifest}"],
  navigateFallback: "/student/index.html",
  navigateFallbackAllowlist: [/^\/student\//],
  navigateFallbackDenylist: [/^\/v1\//, /^\/media\//],
  runtimeCaching: [],
  cleanupOutdatedCaches: true,
};
