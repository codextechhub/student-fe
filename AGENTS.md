# AGENTS.md - student-fe

The XVS student app: the pupil's own app, an installable PWA, served at the
school's address under `/student/` (`bright-star.xvs.codexng.com/student/`).
The build plan, the owner's decisions and what the API serves are in
`docs/student-portal-design-phases.md`. Read it before building a screen; do
not re-ask a decision it records.

## The rules this app shares with school-fe

school-fe's `AGENTS.md` is the house rulebook, and these parts of it apply here
word for word: **Field Access impact** reporting, **ship-check**, **Wrapping up:
report in plain words**, **Asking, suggesting and disputing: use a real
example**, **Fixing problems: root cause, not symptom**, **Comments: short
inline, the story in the doc block**, **Writing punctuation** (no em dashes),
**Vocabulary: it is a branch, never a campus**, and **Brands** (this app is
XVS: `SchoolMark` and `LoadingMark`, the school's crest first, the XVS crest as
the fallback, never the bare CodeX mark).

`PageShell`, `PageHeader`, `ScrollArea`, `SchoolMark`, `LoadingMark` and
`src/index.css` are copies of school-fe's. Keep them in step: a fix to one
belongs in both.

## What is different here

- **Everything lives under `/student/`.** Vite's `base`, the router's
  `basename`, the manifest, the service worker's scope. school-fe owns the
  origin's root, so a root-relative address (`/svg/...`) loads school-fe's
  file, not ours. Use `import.meta.env.BASE_URL` for public assets.
- **One phone, several pupils.** Nothing a pupil can read may be cached by
  address: not in the service worker (`pwa.config.ts` has no runtime caching,
  and a test holds it there), not in a store keyed only by URL. Each pupil's
  offline copy is kept per pupil and wiped when that pupil signs out.
  Switching pupils clears every in-memory read before the next pupil's first
  screen draws.
- **No token in JavaScript.** Each pupil's sign-in is an httpOnly cookie the
  API sets. The app keeps only `{account, name, photo}` per pupil for the
  switcher. This app shares an origin with school-fe, so anything readable here
  is readable by school-fe's scripts too.
- **Switching pupils is one step.** `auth/device-session.ts` owns every change
  to who is showing: it does its waiting first, then clears the API cache and
  sets the new pupil in the same tick, and the request layer drops any answer
  that arrives after the pupil changed. Never set the active pupil anywhere
  else.
- **school-fe hands pupils across.** Its sign-in page leaves the device account
  in sessionStorage under `xvs.student.handover` and opens `/student/`; both
  apps name that key and must agree.
- **Phones are the main screen.** The layout is derived from the desktop design.
  Navigation is the floating tab bar at every size, desktop included (the
  owner's choice); sheets come up from the bottom on a phone; wide screens may
  split a screen into two panes. Horizontal page overflow is a bug.
- **Money comes from the API as kobo.** Never compute a balance the API can
  give; after a payment, read `fees/` again.

- **The store app is this app in a Capacitor shell.** Native code is additive,
  asks `isNativeApp()` (`src/native/platform.ts`) and nowhere else, and never
  changes the web behaviour. How it is built and what differs is in
  `docs/native-app.md`.

## Running it

- Use the arm64 Node (`node -p process.arch` says `arm64`); the Intel one at
  `/usr/local/bin/node` installs the wrong native tools.
- `npm run dev`, then open `http://lagoon-view.localhost:5175/student/`. The
  school is read off the subdomain; a bare `localhost` shows "No school at
  this address". `/v1` is proxied to `localhost:8000`.
- The service worker is not registered by the dev server. To check it,
  `npm run build` then `npm run preview -- --port 4175` and open
  `http://lagoon-view.localhost:4175/student/`.
- Before committing: `npx tsc -b`, `npx eslint . --max-warnings 0`,
  `npm test`, `npx vite build`. CI runs the same four.
- Test pupils come from the backend's `seed_student_portal_scenarios`; the
  plan lists who signs in as whom.
- Releasing: `./deploy-staging.sh` puts main on staging; `./release.sh
  promote` moves staging to production with a version tag, `rollback <tag>`
  steps back. Both are school-fe's scripts, kept in step with them. Commit
  only to main.
