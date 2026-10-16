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
