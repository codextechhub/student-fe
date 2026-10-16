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
school-fe on the same origin. The host needs two rules:

- `/student/*` serves this app's build (`dist/`), falling back to
  `/student/index.html` for any address that is not a file, so the app's own
  routes load on a refresh.
- `/student/manifest.webmanifest` passes through to the API's
  `/v1/portal/student/app/<slug>/manifest.webmanifest`, with `<slug>` taken
  from the school's address (`corona.xvs.codexng.com` is `corona`). That
  manifest carries the school's name and icons drawn from its crest. When the
  API cannot be reached, serve `dist/manifest.webmanifest`, the XVS one.

The dev server does both itself (see `vite.config.ts`).
