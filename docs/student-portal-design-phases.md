# M27 Student Portal: design breakdown and build phases

**Design:** `backend/docs/designs/Student Portal - Desktop.html` (bundled
export, 120 KB of markup once unescaped, 51 `sc-if` blocks, all 51 accounted
for, 21 `sc-for` collections). Its mock data module (`portal-data.js`) was
decompressed from the bundle and read in full. The phone frame,
`Student Portal - Mobile.html` (61 blocks), shares the same data and adds only
navigation; its extra flags are listed in 1.3.
**Backend contract:** `backend/docs/student-portal-api-plan.md`, approved 15
October 2026, its section 13 ("As built"), and the "Pupil portal" sections of
`backend/docs/FRONTEND_CHANGES_OWED.md`. Where the design and those disagree,
the backend documents win: they record the owner's later decisions.
**Where it is built:** this project, `student-fe`, not school-fe.

### The owner's decisions (16 October 2026)

1. `student-fe` is served at the school's own address under `/student/`
   (`corona.xvs.codexng.com/student/`), not inside school-fe and not on its
   own subdomain.
2. On phone and tablet it is an installable app (PWA), not a website. No app
   store now; a Play Store listing stays possible later.
3. Pupils sign in with their admission number or their email. The sign-in
   screen lives in `student-fe` (it is the installed app's start page and where
   "add another pupil" happens). A pupil who uses school-fe's sign-in page
   is handed across to `/student/` by the server.
4. A pupil stays signed in for 30 days of use. One phone holds several pupils
   and switches between them (Tunde and his sister Bola on their mother's
   phone). Sign out ends that pupil on that phone only.
5. The home-screen icon and name are the school's crest and name, falling back
   to the XVS crest, never the bare CodeX mark.
6. Push notifications (Web Push) come later; the app launches without them.
   What a push shows on a locked screen is still open.
7. Offline: the last data seen, read-only, marked "Last updated 7:12am", under
   an offline bar. Paying and edits wait for a connection.
8. Phone and tablet layouts are derived from the desktop design: bottom tabs,
   full-screen sheets, pull to refresh. The owner reviews them on a phone.
9. Tablet upright is the phone app; tablet sideways is a desktop-style side
   rail, with two panes where they help (notices, fees).
10. Messages and Assignments are not built, and are hidden.
11. **Paying offers two choices, Card and Bank transfer.** Card goes to
    Paystack's own page (OPay is only what Paystack offers there) and comes
    back to the app. Bank transfer shows the pupil's **permanent** account
    number inside the app, and the page turns to "received" when the deposit
    lands, without leaving. The minimum part payment applies to card only.
12. **A per-school switch, "Apply bank transfers to open bills
    automatically", default on**, applies a transfer to open bills by the
    school's existing "default receipt allocation" setting; anything over
    stays as credit.

### Agreed with the backend

- **Sessions:** one httpOnly cookie per signed-in pupil, named
  `xvs_prt_<device-account id>` (random and opaque), Secure, SameSite=Strict,
  path scoped to the auth routes, 30 days sliding, rotated on every refresh.
  The app keeps only `{account, name, photo}` per pupil in IndexedDB for the
  switcher, never a token: `student-fe` shares an origin with school-fe, so
  anything JavaScript can read there, school-fe's scripts can read too.
  Production is same-site (`api.codexng.com` and `<slug>.xvs.codexng.com`), as
  the staff refresh cookie already relies on.
- **Each pupil's offline copy is kept separately and wiped when that pupil
  signs out.** Switching to Bola never shows Tunde's results, even for a
  moment. Signing out also removes that pupil's push subscription on the
  phone. A shared phone's pushes start with the child's first name.
- **Dev:** Vite + React + TypeScript + Tailwind + RTK Query + vite-plugin-pwa,
  port 5175 (strict), base `/student/`, `/v1` proxied to the backend:
  `http://lagoon-view.localhost:5175/student/`.

---

## 1. What the design contains

### 1.1 Screens

Size is the markup inside each screen's span (SVG stripped), a fair proxy for
how much there is to build.

| Screen | Size | States inside it | Collections | Writes |
|---|---|---|---|---|
| **Results** | 14.2 KB | two tabs. **This term**: 4 tiles, a card per subject (teacher, score, grade, CA/exam, remark), a chart by subject, the term report card button. **Full session**: 4 tiles (cumulative average, position, terms published, promotion), a strip per term with "This term" on the current one, a subject x term table with three bars and a change arrow, the promotion banner, the session remark and signer, the annual card button | `resultCards`, `chart`, `termStrip`, `sessionRows` > `r.bars` | none |
| **Pay modal** (`payOpen`) | 12.1 KB | six steps. **Amount**: full or part, amount field with four errors (empty, zero, below ₦1,000, above balance), "remaining after". **Gateway**: method Card / Bank transfer / USSD, "details are entered on the gateway". **Processing**, **Success** (reference, method, new invoice status, View receipt), **Pending** ("receipt available after confirmation"), **Failed** ("you haven't been charged", Try again) | none | start a payment |
| **Home** | 5.9 KB | greeting; today's classes with Now / Next / Done; today's mark and term rate; fee balance with status chip and due date; latest notice; unread messages; assignments due soon | `today`, `dueSoon` | none |
| **Assignments** | 5.9 KB | list and detail. Per assignment: teacher's attachments or none; **not submitted** (text box, attach one file, submit once, disabled until something is entered); **submitted** (when, what, waiting); **graded** (score of total, feedback) | `assignmentList`, `asg.attachments` | submit |
| **Fees** | 5.6 KB | "normally paid by your guardian" banner; term fee, paid, balance; the invoice, collapsible, with its lines; **balance** (Pay balance) / **fully paid**; payment history, each **with receipt** or "No receipt yet" | `payments` | none (opens Pay) |
| **Profile** | 5.5 KB | photo with Change photo; "Managed by the school" block (name, admission number, class and year, date of birth, school email, primary guardian); "You can edit" block, **viewing** / **editing** with phone and email errors, Save disabled until changed and valid | none | phone, email, photo |
| **Attendance** | 5.0 KB | rate, encouragement line, present / absent / late counts; a calendar per month (present, late, absent, no school); "Days to note" | `calendars` > `mo.head`, `mo.cells`; `notes` | none |
| **Messages** | 3.6 KB | thread list with unread counts; a thread; compose and send, disabled while empty | `threadList`, `thread.messages` | send |
| **Sign in** | 3.4 KB | school email and password, each with an error; Forgot password | none | sign in |
| **Timetable** | 3.1 KB | today's list with Now / Next / Done and "Next: ..."; the week grid with break rows and today's column | `today`, `weekDays`, `grid` | none |
| **Notices** | 2.6 KB | list with unread dots and "N unread / All read"; a notice, **unread** (Mark as read) / **read**; Mark all as read | `noticeList` | mark read, mark all read |

### 1.2 Overlays

| Overlay | Size | States |
|---|---|---|
| **Pay** (`payOpen`) | 12.1 KB | the six steps above |
| **Annual report card** (`annualOpen`) | 5.9 KB | letterhead; three terms, cumulative and grade per subject; term average and position rows; promotion decision; session remark; attendance; Download PDF |
| **Term report card** (`reportOpen`) | 4.6 KB | letterhead; CA, exam, total, grade per subject; average and position; remark; attendance; next session; Download PDF |
| **Receipt** (`receiptOpen`) | 3.8 KB | number, date, reference, payer, part or final payment, amount, method, balance after this payment; Download PDF |
| **Toasts** | small | success / info / error |

### 1.3 Shared chrome and row models

- **Sidebar:** nine items (Home, Timetable, Results, Attendance, Assignments,
  Notices, Messages, Fees, Profile), unread badges on Notices and Messages,
  Sign out. School name and "Lekki Branch · Student" at the top.
- **Header:** the screen title, "2025/2026 · Third Term", the pupil's initials,
  name, class and admission number.
- **Row-scoped flags (14):** `item.badge`, `c.badge` (Now / Next / Done),
  `d.isToday`, `cell.sub`, `t.isCurrent`, `t.unread`, `notice.read` /
  `notice.unread`, `p.hasReceipt` / `p.noReceipt`, `asg.canSubmit` /
  `asg.isSubmitted` / `asg.isGraded` / `asg.hasAttachments`.
- **Phone frame only:** a bottom tab bar (`showTabs`), a More sheet
  (`isMore`), back buttons (`showBack`), the school line (`showSchool`), lists
  and details as separate screens (`isNoticeList` / `isNoticeDetail`,
  `isThreadList` / `isThread`, `isAssignmentList` / `isAssignmentDetail`), and
  day tabs on the timetable (`t.isToday`, `t.badge`).

### 1.4 The mock tenant, and what it requires

There is **one** mock pupil, Chiamaka Nwosu, JSS1 A at Brightfield Schools,
Lekki Branch, on 8 July 2026: the last week of the year, all three terms
released, promoted, two-thirds paid, two confirmed payments by her mother, one
assignment of each state, one unread thread.

One tenant means the design draws none of the states that recede or refuse.
The backend serves all of them, so the build has to draw them itself (2.2):
a one-branch school (no branch line), a held term, a year with only one term
released, an unpublished timetable, a school that turned student payment off,
a pupil with no email, a pupil in credit, and a block on Home that could not
be read.

---

## 2. What the backend can serve

### 2.1 The four buckets

All pupil routes are under `/v1/portal/student/`; money is in kobo; anybody
who is not a linked pupil gets 404. "Building" means the backend session has
agreed the shape and is building it.

| Screen | Bucket | Endpoint |
|---|---|---|
| Sign in, keep several pupils, sign out one | **Absent, building** (first in the backend's queue) | per-pupil session routes under `/v1/user/auth/`, shapes to come |
| Hand-off from school-fe's sign-in page | **Absent, building** | a hand-off endpoint that turns the staff refresh cookie into a pupil cookie |
| Home-screen icon and name | **Absent, building** | `/student/manifest.webmanifest`, passed through to the backend |
| Shell (name, class, admission number, school, branch, year, term) | **Served, not wired** | `GET me/` |
| Home | **Served, not wired** | `GET home/` (five blocks, each with `available`) |
| Timetable | **Served, not wired** | `GET timetable/` |
| Attendance | **Served, not wired** | `GET attendance/?term=` |
| Results, this term | **Served, not wired** | `GET results/?term=` |
| Results, full session | **Served, not wired**; four figures **building** (2.3) | `GET results/session/?session=` |
| Term and annual report card | **Served, not wired** | `GET results/report-card/?term=` |
| Fees, payment history | **Served, not wired** | `GET fees/`, `GET fees/payments/` |
| Receipt | **Served, not wired** | `GET fees/payments/{ref}/receipt/`, `?as=pdf` |
| Pay by card | **Served, not wired**; return address **building** | `POST fees/invoices/{ref}/pay/`, back to `/student/fees/paid?reference=`, then the public status route |
| Pay by bank transfer | **Absent, building** | `GET/POST fees/transfer-account/` (`ISSUED`, `PENDING`, `NONE`, `UNAVAILABLE`; 403 when `can_pay` is false); `GET fees/transfer-account/deposits/?since=<as_of>` |
| Transfers applied to bills | **Absent, building** (last in the backend's queue) | per-school switch; deposits allocate by the school's receipt allocation setting |
| Profile | **Served, not wired** | `GET/PATCH profile/`, `POST/DELETE profile/photo/` |
| Notices | **Served, not wired** | `GET notices/`, `GET notices/{id}/`, `POST notices/{id}/read/`, `POST notices/read-all/` |
| Push notifications | **Absent, building**; two owner decisions open | not to be built on yet |
| Messages, Assignments | **Absent, parked** | hidden |

**Bucket 3 (exists but closed) is empty.** The portal is closed to a school
that has not gone live, by design.

### 2.2 Served, and no screen draws it (reverse audit)

Each of these must be built anyway, because a real pupil will reach it:

1. **A held term** (`state: withheld`, a sentence, no figures) and **no
   results yet** (`not_published`).
2. **An unpublished timetable** (`published: false`), including while a
   published grid is being edited.
3. **A Home block that could not be read** (`available: false` with a
   sentence). The design draws every block as if it always arrives.
4. **Fees unavailable** (503 `FINANCE_UNAVAILABLE`), **in credit**
   (`IN_CREDIT`), **several invoices** (the design draws one), and **student
   payment turned off** (`can_pay: false`, so no Pay button and no fallback
   copy).
5. **Excused absences and closed days** in attendance. The design's legend has
   present, late and absent only.
6. **A term picker** on Results (`terms[]` with each term's state) and on
   Attendance (`terms[]`). The design only shows the current term, so a pupil
   cannot look at First Term's results or attendance on their own.
7. **Earlier school years** (`?session=` on the session read). Without a
   picker, a pupil promoted to JSS2 loses sight of JSS1 once JSS2's first term
   is released.
8. **Remove photo** (`DELETE profile/photo/`). The design has Change only.
9. **A notice corrected after publishing** (`edited_at`).
10. **The pupil's notification inbox** (`/v1/notify/`, and the unread count on
    Home). No screen draws it.

### 2.3 Elements nothing could serve as drawn, and their rulings

1. **The design's own sign-in screen** ("Use the email address your school
   invited you with"). Ruled: the sign-in screen takes an admission number or
   an email.
2. **Messages, Assignments, the Home unread-messages tile, the Home "due soon"
   list, the Messages badge.** Ruled: hidden. No empty nav item, no "coming
   soon", no sample data a pupil could take for real homework.
3. **"Pass mark 50%"** on the promotion tile and banner. Ruled: the decision
   alone.
4. **Phone validation "11 digits, Nigerian".** The backend's 7 to 15 digits
   in any country's writing stands.
5. **"Prototype only · gateway outcome"** buttons. A prototype device, not
   built.
6. **Choosing Card / Bank transfer / USSD in the portal.** Ruled: Card and
   Bank transfer only (decision 11).
7. **Success, pending and failed inside the portal.** Card: the return page
   `/student/fees/paid` polls the status and shows the three outcomes, and a
   receipt only once confirmed. Transfer: the in-page panel shows "received" as
   soon as a deposit row appears and the receipt once it is confirmed.
8. **"Class average" under the cumulative average.** Building: the mean of the
   released terms' class averages, only where the school shows class figures;
   absent means the tile's line recedes.
9. **"3 of 3" terms published.** Building: `terms_total`.
10. **Teacher and grade on each full-session row.** Teacher from the latest
    released term's result for the same subject; the annual grade is building
    (the school's scale on the annual average; null means the column recedes).
11. **"Published 10 Jul 2026"** under the annual card. Building: `released_at`
    on each term.
12. **The Home messages tile's space.** Left out; there is no inbox screen to
    open. The pupil's notification inbox (`/v1/notify/`) is served and can get
    a screen later.
13. **Encouragement lines** on Home and Attendance. Three bands: 90% and over,
    75 to 89%, under 75% (the last says "talk to your class teacher", never a
    scolding).
14. **"Generated by" and "Powered by CodeX Vision".** Not added. The receipt
    PDF and report card keep their own footers; the shell shows the school's
    crest, or the XVS crest.

---

## 3. The phases

Every phase ships: it builds, `npx eslint . --max-warnings 0`, typecheck and
tests pass, and each screen is driven signed in as a seeded pupil against the
real API at 390px, a tablet both ways, and desktop, at lagoon-view (two
branches) and sunrise-academy (one).

**Screens do not wait for the new sessions.** A pupil can sign in today
through the ordinary sign-in route with the ordinary refresh cookie. Phases 3
to 6 call the API through one auth module; Phase 2 replaces that module's
insides with per-pupil sessions and changes nothing else.

### Phase 0: seed and readiness (backend seeder, no screens)

`seed_student_portal_scenarios` makes the first pupil on the roll its signed-in
pupil, so which states that pupil can show is luck. Check by API at both
schools what the active pupil's reads answer, then extend the seeder, through
the real services, so these pupils exist and are named in its output:

- **the full pupil:** at least two released terms, ideally a year's last term
  (cumulative block, promotion), part-paid with one confirmed and one pending
  card payment, a published timetable, a permanent transfer account;
- **a sibling** of the full pupil with an account of their own, for the shared
  phone;
- **a held pupil:** a term withheld;
- **a pupil with no email**, signing in by admission number only;
- **a pupil whose class timetable is unpublished.**

**Done 16 October 2026** (backend `2ad8fb10`). Every pupil signs in with
`Pupil@School2026` and was checked through the real sign-in route and the
portal's reads:

| Role | lagoon-view (two branches) | sunrise-academy (one branch) |
|---|---|---|
| Active (published timetable) | Adaeze Adeyemi, `LV/2026/0026`: JSS1 A, one term released | Adaeze Adeyemi, `SUN/2026/0262` |
| Full | Ebere Bello, `LV/2026/0029` or `ebere.bello@lagoon-view.example.com`: JSS2 A, last year's three terms with the year-end block, billed, part-paid at the desk (₦11,687.50 owing), one card payment still being confirmed | Amaka Balogun, `SUN/2026/0265` or `amaka.balogun@sunrise-academy.example.com`: one term released, nothing billed (no fee structure) |
| Sibling (shared phone) | Femi Bello, `LV/2026/0030`: same guardian, no email, owes nothing | Musa Balogun, `SUN/2026/0266` |
| Held | Zainab Afolabi, `LV/2026/0031`: term withheld | none at this school |
| Invited / revoked | Tunde Adeleke / Amaka Adeleke | Bola Okoro / Tunde Okoro |

Things the seeded data shows that the screens must handle:

- **Unpublished timetable:** every JSS2 A pupil (Ebere, Femi, Zainab) and all
  of sunrise-academy. Only lagoon-view JSS1 A has a published one.
- **A pending card payment's method reads "Online"** until it is confirmed:
  the pupil may switch to a transfer or USSD on Paystack's own page. Show the
  API's `method_label`; while pending, "Waiting for confirmation" is acceptable
  wording, never "Card".
- **No class on the header** for Zainab: a promotion run moved her into next
  year's draft year early. The backend is making `me/` fall back to the
  next-year placement, labelled with its year, so `class_name` may name a class
  of a year that has not started.

### Phase 1: the `student-fe` project

- Vite, React, TypeScript, Tailwind, RTK Query, vite-plugin-pwa; base
  `/student/`, port 5175, `/v1` proxy; CI running eslint first, as the other
  apps do; a `.claude/launch.json` entry and the overflow probe pointed at
  `/student/`.
- The UI pieces the house conventions name (`PageShell`, `PageHeader`,
  `ScrollArea`, `SchoolMark`, `LoadingMark`, the table's phone-card mode),
  copied from school-fe as the starting point; this app keeps them in step the
  way school-fe and console-fe do.
- The XVS crest and loader as the fallback brand; the manifest and icons from
  the backend route once it exists.
- A service worker that caches the app shell only. Pupil data caching comes
  with Phase 3, per pupil.

**Done 16 October 2026.** The project builds, lints, typechecks and passes its
tests. The start page shows the school's crest (or the XVS crest) and name from
the public routes, "No school at this address" on a bare host, and a not-found
page, at phone width without overflow. The production build registers one
service worker scoped to `/student/` whose cache holds only the app's files; a
test keeps API and media addresses out of it. Not yet done: a remote
repository, and the hosting rule that sends `/student/*` on a school's address
to this app (and `/student/manifest.webmanifest` to the backend once its
per-school manifest exists).

### Phase 2: signing in, several pupils, signing out

The backend's routes are built (backend `5bfa0543`, `8a8aea02`). Every call
carries cookies, an `X-CSRFToken` from `GET /v1/user/auth/csrf/`, and, once
signed in, `Authorization: Bearer <access>` with `?tenant=<slug>`.

| Call | Body | Answers |
|---|---|---|
| `POST /v1/user/auth/login/` | `{identifier, password, tenant, session: "device"}` | 200 with `account` (32 hex), `access` (15 minutes), `user`, `school`; the credential is an httpOnly cookie `device_session_<account>` on `/v1/user/auth/`, lasting the school's `session_days` (default 30). No refresh token in the body. 403 `DEVICE_SESSION_NOT_OFFERED` for a staff account: send them to the school's main sign-in. Otherwise the usual 401 `INVALID_CREDENTIALS` and 403 not activated, locked, suspended, deactivated. |
| `POST /v1/user/auth/device/refresh/` | `{account}` | 200 `{access, account, session_id}`, cookie rotated and its days restarted. 409 `TOKEN_STALE` (in `error.error_code`): another window refreshed first, the cookie is untouched, ask again. 401 `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `TOKEN_INVALID`: the cookie is cleared, drop that pupil and show sign-in. |
| `POST /v1/user/auth/device/sign-out/` | `{account}` | Always 200; ends that pupil on this phone only. The app wipes that pupil's offline copy itself. |
| `POST /v1/user/auth/device/hand-over/` | none | From school-fe: a normal sign-in answers `device_app: {path: "/student/"}` for a pupil (null for staff); school-fe calls this, then goes to `app_path`. 200 `{account, access, session_id, app_path}`. |

**Refreshing:** one refresh per pupil at a time, across every tab and window
of the app: `navigator.locks.request("refresh:" + account)` around an in-tab
promise, and on 409 `TOKEN_STALE` one retry after the lock. The switcher keeps
only `{account, name, photo}` per pupil in IndexedDB; the photo comes from
`me/`.

- **In `student-fe`:** the sign-in screen; the pupil switcher; "Add another
  pupil"; "Sign out" (this pupil, this phone); the auth module refreshing per
  pupil. Switching clears every in-memory read before the next pupil's first
  screen draws.
- **In school-fe:** the sign-in box's wording names the admission number; a
  pupil signing in there is handed to `/student/`; the activation and reset
  pages show the admission number where a pupil has no email (both show an
  empty "Email" field today).

**Done 16 October 2026** (student-fe and school-fe `0168851`). Driven in
the browser against the real API: Ebere signs in, Femi is added on the same
phone, the two switch both ways, a reload opens the pupil used last, signing
Ebere out leaves Femi signed in and showing, school-fe's sign-in hands Adaeze
across to `/student/` and leaves school-fe with no session, and the reset and
activation pages show "Signs in with: LV/2026/0030" and send a pupil to the
student app's sign-in. At 390px nothing overflows, the switcher is a bottom
sheet, and inputs are 16px.

Found while driving it, fixed with tests: switching cleared the last pupil's
reads, then waited on storage before making the next pupil active, and in that
gap the still-mounted screen refetched the last pupil's details into the cache
the next pupil's screen read ("Hi, Femi" on Ebere's screen). The switch now
does its waiting first, and the request layer drops any answer that arrives
after the pupil showing changed. Activation turned out to sign nobody in, so
school-fe sends a pupil straight to the student app's sign-in after it.

### Phase 3: shell, Home, Notices, Profile

- **Shell:** desktop sidebar of the screens built so far; on a phone and an
  upright tablet, bottom tabs with a More sheet; sideways tablet, the side
  rail. Header from `me/`; the branch line recedes where `show_branch` is
  false. Pull to refresh. The offline bar and "Last updated" from the
  per-pupil offline copy.
- **Home:** the five blocks, each with its own unavailable state; links only
  to screens already built.
- **Notices:** list and detail (two panes on a sideways tablet), mark read,
  mark all read, unread badge, edited notices.
- **Profile:** both blocks, phone and email edits with the server's per-field
  refusals, photo change and remove behind `photo_editable`; edits disabled
  offline.

### Phase 4: Timetable and Attendance

- **Timetable:** today's list and "Next", day tabs on a phone, the week grid
  on wider screens, the unpublished state.
- **Attendance:** counts, rate and encouragement line, month calendars, days
  to note, excused and closed days, a term picker.

### Phase 5: Results and report cards

- **This term:** tiles (position only where the school ranks, class average
  only where it shows class figures), subject cards, chart, a term picker,
  held and not-yet-published states.
- **Full session:** tiles, term strip, the subject table with bars and the
  change arrow, promotion, remark and signer, an earlier-year picker. The four
  figures in 2.3 items 8 to 11 slot in as the backend ships them; each
  recedes while absent.
- **Report cards:** term and annual sheets rendered from the served card, the
  same layout as school-fe's `ReportCardSheet` and `YearBlock`; Download PDF
  prints through the browser, as the backend plan chose.

### Phase 6: Fees, receipts and paying

- **Fees:** the "normally paid by your guardian" banner, totals, a card per
  invoice (two panes on a sideways tablet), payment history with payer and
  method, and the unavailable, in-credit and payment-off states.
- **Receipt:** sheet from the JSON; Download PDF fetches `?as=pdf`.
- **Pay:** choose Card or Bank transfer.
  - **Card:** amount (full or part, the minimum shown and enforced by the
    server's refusal sentences), then Paystack. Back at `/student/fees/paid`:
    confirmed with the receipt, still confirming (keeps asking), or failed
    (nothing charged, try again).
  - **Bank transfer:** the pupil's own account, with their name in large type
    beside the number so a parent paying for two children picks the right one;
    copy buttons; `PENDING` while the account is being issued, `NONE` asks for
    one, `UNAVAILABLE` shows the school's sentence. The panel watches deposits
    since the server's `as_of`, shows "₦X received" when a row appears, then
    re-reads `fees/` for the real balance and offers the receipt once
    confirmed.
  - Offline: Pay is disabled with a sentence.
- **Staff side, in FinPro:** the switch "Apply bank transfers to open bills
  automatically" beside "default receipt allocation" on Finance settings,
  Banking and cash. Released with `release.sh` and moved in school-fe and
  console-fe in the same change. Field Access: a stored, submitted setting, so
  separate Read and Write switches, registered on the backend in the same
  change.

### Phase 7: push notifications

Waits for the backend's push channel and the owner's two open decisions (what
a locked screen shows; the `pywebpush` dependency). Asks for permission only
after a pupil's first sign-in, never on first load.

### Parked: Messages and Assignments

No module owns them. When the owner calls for them, each starts from its own
backend plan and a staff-side design.

---

## 4. Order, and why

1. **Phase 0 first** because the design's single pupil leaves every unhappy
   state undrawn, and the current seeder picks its signed-in pupil by id.
2. **Phase 1 next** because there is no project yet.
3. **Screens before sessions.** Phase 2 is the only phase blocked, on the
   backend's first item. Phases 3 to 6 build on today's ordinary sign-in
   through one auth module, so the wait costs nothing; Phase 2 slots in when
   the routes land and must ship before the app is offered to any school,
   because without it a shared phone holds one pupil.
4. **Reads before money.** Home, Notices and Profile prove the shell and the
   offline copy on the simplest full screens; Results needs the backend's four
   figures, which ship second in its queue; Fees comes last because its card
   return and transfer routes ship second and third.
5. **Push last, and parked until the owner decides.**
6. **What we control:** everything except Phase 2's start, the bank-transfer
   panel's routes and push. Each of those is a backend item already agreed and
   queued, not an open question.
