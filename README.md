# XVS Student

The pupil's own app: classes, results, attendance, notices, fees and paying,
on a phone as an installed app. Served at a school's address under `/student/`.

```bash
npm install
npm run dev
```

Then open `http://lagoon-view.localhost:5175/student/` (the school is read off
the subdomain). See `CLAUDE.md` for how the app is built and
`docs/student-portal-design-phases.md` for the plan.

## Releasing

Three branches, as in school-fe:

- `main` is where work is committed. CI checks every push to it.
- `staging` is `main`, put there by `./deploy-staging.sh` (reset and
  force-pushed); the host deploys it on its own. Nobody commits to it.
- `production` only moves forward. `./release.sh promote [patch|minor|major]`
  fast-forwards it to staging's tip and tags the release (`v1.0.0` first);
  `./release.sh rollback <tag>` adds a commit carrying that release's files.
  `./release.sh status` shows where the three stand. Production is deployed by
  hand from the host after the branch moves.

## Hosting

The app is served on each school's own address under `/student/`, beside
school-fe on the same origin (`bright-star.xvs.codexng.com/student/`). Both
are Render static sites behind Cloudflare. Render's rules match paths only,
never the host, so nothing here depends on knowing which school was asked
for: the app works that out itself and names the school in the path.

Each environment (staging, then production) needs three things, in this
order.

### 1. A static site for this app

A new Render **Static Site** per environment, from `codextechhub/student-fe`:

| Setting | Staging | Production |
| --- | --- | --- |
| Branch | `staging` | `production` |
| Build command | `npm ci && npm run build` | same |
| Publish directory | `dist` | same |
| `VITE_BACKEND_URL` | the staging API, ending `/v1` | `https://api.codexng.com/v1` |
| Auto-deploy | on | off (deployed by hand, as school-fe is) |

Under **Redirects/Rewrites**, one rule: Rewrite `/*` to `/index.html`. A
file that exists is served first, so this only catches the app's own routes
on a refresh.

Under **Headers**, `Cache-Control: no-cache` on `/sw.js` and on
`/index.html`, so a new version reaches phones on their next open rather than
whenever a cache lets go. Everything under `/assets/` is named by its content
and may be cached for good.

### 2. Two rules on school-fe's static site

On the **existing** school-fe static site of the same environment, under
**Redirects/Rewrites**, add these **above** its catch-all `/*` to
`/index.html` rule (rules run top to bottom, and the catch-all would
otherwise answer `/student/` with school-fe's page):

| Type | Source | Destination |
| --- | --- | --- |
| Rewrite | `/student/app/*` | `<API>/v1/portal/student/app/*` |
| Rewrite | `/student/*` | `https://<this app's static site>.onrender.com/*` |

The first passes the school's own manifest and crest icons through from the
API. The app asks for `/student/app/<slug>/manifest.webmanifest` on its own
address (`src/lib/school-app.ts`); until that answers, the XVS manifest in
`dist/` stands in, so the app can always be installed. The second serves this
app: `/student/fees` is fetched from the app's site as `/fees`, and its own
catch-all hands it `index.html`.

### 3. Push keys on the API

On the same environment's backend **web service and worker** (the web
service hands out the key; the worker sends the pushes), set:

- `WEB_PUSH_VAPID_PUBLIC_KEY` and `WEB_PUSH_VAPID_PRIVATE_KEY`, one pair per
  environment, made once and kept. A new pair orphans every phone's
  subscription: each pupil's phone re-subscribes the next time they open the
  app, and pushes sent before then are lost.
- `WEB_PUSH_CONTACT`, a `mailto:` a push service may write to.

Without the keys the app offers no notifications and says nothing; nothing
breaks. Make a pair with the backend's own environment, and paste the two
lines straight into Render without keeping them anywhere else:

```bash
cx/bin/python -c "
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
k = ec.generate_private_key(ec.SECP256R1())
b = lambda x: base64.urlsafe_b64encode(x).rstrip(b'=').decode()
print('WEB_PUSH_VAPID_PRIVATE_KEY=' + b(k.private_numbers().private_value.to_bytes(32, 'big')))
print('WEB_PUSH_VAPID_PUBLIC_KEY=' + b(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)))"
```

### Checking an environment

With `<school>` a real school's address on that environment:

1. `https://<school>/student/` shows the sign-in page with the school's name,
   and `https://<school>/student/fees` survives a refresh.
2. `curl -sI https://<school>/student/sw.js` is JavaScript with
   `cache-control: no-cache`, not school-fe's HTML.
3. `curl -s https://<school>/student/app/<slug>/manifest.webmanifest` is the
   school's manifest (its own `name`).
4. Signed in as a pupil, Home offers notifications; turning them on and
   publishing a notice brings a push.

The dev server and `vite preview` follow the same `/student/app/` rule
themselves (see `vite.config.ts`).
