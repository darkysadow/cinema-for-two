# Vercel deployment checklist

Preparation only. No deployment, hosted settings or migrations were changed. The user subsequently authorized demo-account QA: local production/live-backend browser checks passed, exactly two new sessions were retained, and both original Watchlists were restored. Detailed scope is in the verification matrix; public-origin smoke is still required. Resolve the remaining items before final submission; M3 is not complete.

## Build and environment

- [ ] Review [the current verification matrix](docs/VERIFICATION.md), then perform a clean `npm ci` and checks on Node **22.x**, matching CI and the locked Supabase minimum. The preparation host uses Node 23.8.0; `package.json` has no engines override.
- [ ] Import the repository with **Next.js** framework preset, repository root as root directory, npm install command `npm ci`, and framework-managed output directory. Keep the Next Node runtime; do not use a static export. The app needs server reads, cookie-based Auth, Server Actions and RPCs.
- [ ] Set Node **22.x** in Project Settings. Official [Vercel runtime documentation](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) lists 22.x support; its default may differ. `package.json` engines can override settings, so recheck if changed later.
- [ ] Choose and record the build command. `npm run build` is the package/CI default (Turbopack); local sandbox failure is recorded separately. `npm run build -- --webpack` is the locally verified alternative. If used, set it explicitly as the Vercel Build Command; do not assume local output proves a hosted build. See [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build). No `vercel.json` or custom runtime settings are currently needed.
- [ ] Add the variables below to the intended Production/Preview environment before building. Preview may use the same backend unless an isolated project is deliberately chosen; do not create test data without authorization. Changes require a new deployment, per [Vercel environment documentation](https://vercel.com/docs/environment-variables).

| Required variable | Exposure and purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public, browser/build and server; intended Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public, browser/build and server; that project’s publishable or legacy anon key. Never substitute a privileged key. |
| `TMDB_READ_ACCESS_TOKEN` | Secret, server runtime only; configure before build too. Must never occur in static browser output or logs. |

Omit optional `DEV_TUNNEL_HOST` in production. The implementation does not need `SUPABASE_SERVICE_ROLE_KEY`, an admin password, `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` or a custom callback URL variable. Allow server access to TMDB and Supabase and browser access to the TMDB image CDN/Supabase. Public-prefix values are embedded at build time.

## Supabase owner checks — manual

- [ ] Confirm the correct production project, both migrations already applied in order, controlled function ownership, table grants/RLS and both confirmed demo accounts/profile mappings. Use [README fresh setup](README.md#fresh-supabase-setup) only for a new project; **do not reapply migrations to an existing one**.
- [ ] Inspect Auth → URL Configuration: Site URL must be the final HTTPS production origin; remove stale production localhost/tunnel assumptions. Review allowed local/preview URLs and use narrow production entries. Follow [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls). This app signs in with password and redirects through an application-local allowlist, without OAuth/email callbacks; URL configuration alone does not verify session-link return behavior.
- [ ] Confirm email/password enabled and public registration disabled. Verify `alex`/`partner` map to the intended two distinct Auth users. Transfer emails/passwords privately. Hosted configuration has not been inspected during this preparation.

## Post-deployment smoke — both 360px and 390px

Use a public signed-out browser and separate authorized demo sessions. Ask for permission before creating hosted test data; preserve all pre-existing rows.

1. Public catalog/details/login load over HTTPS. Test title/blank/empty Search, genre, all three sorts and their explanations, Reset, Load more, reload and Back/Forward including appended details → Back. Verify loading, failed transition/retry, later-page retry, cap and no-results distinctions using an authorized safe fixture/interception where needed.
2. In a local fixture/intercepted browser environment, also check malformed/repeated/oversized/mixed URLs, direct multi-page reconstruction and partial-range failure/retry, genre outage with and without a requested genre, and Retry genres. Confirm Search remains usable and a removed genre is not silently reapplied on recovery (TEST-M25-B/R cases). Avoid disrupting hosted upstream services.
3. Check invalid/missing movie feedback, poster failures, unavailable and valid-zero ratings, touch controls/focus/keyboard, pending/error states and no blocking horizontal overflow. Inspect browser console/network without exporting secrets.
4. Sign in privately as each demo user; test wrong-password feedback, intended detail/session return, save/reload/new-sign-in persistence, duplicate saves, remove and sign-out. Check direct ordinary-user/anonymous requests cannot read/write the other user’s Watchlist. Fixture SQL results are insufficient here.
5. With approved disposable data, reject invalid/self/unknown invites and failed session creation, retain selections and retry; guard against duplicate/partial sessions. Verify 2–5 fixed candidates, member-only access, signed-out invite → sign-in → return and nonmember denial.
6. Verify private draft/explicit submit, waiting/Refresh without losing the other draft, overlapping votes/matches, disjoint/intentional-empty votes/no match and reload persistence. Check raw foreign ballots remain unavailable before and after results through ordinary-user table/API/RPC access; only the shared intersection is released.
7. Inspect response caching and browser assets for accidental credentials/personalized leakage; record exact URLs, date, environment, accounts’ aliases, case outcomes and limitations without credentials. Do not remove pre-existing records after testing.

## Repository/submission review

The preparation scan found no configured credential matches, JWT-like tokens, private keys, credential-bearing URLs or browser storage-state JSON in candidate text files. This is a bounded scan, not a Git-history or screenshot audit.

- [ ] Owner reviews the **already tracked** `.playwright-mcp/` log, snapshot and PNG and `supabase/.temp/` CLI/linkage metadata (12 files total). They contain environment-specific artifacts; their suitability for public submission remains unresolved. They were preserved. Ignore rules do not untrack existing files; decide explicitly what to exclude from the submission. No history rewrite or deletion was performed.
- [ ] Review rendered screenshots and any past Git history privately if publication is planned; text pattern scanning cannot establish image/history safety. Supabase project/account identifiers are not privileged credentials but do not belong in reusable setup templates. The SQL Editor template now has explicit UUID placeholders; old revisions were not rewritten.
- [ ] Keep `.env.local`, `.next`, `.m1-test-build`, browser auth state, node_modules, logs and temporary QA scripts out of the submission/archive. Local `.env.local` exists and is ignored; `.env.example` is placeholder-only. Audit the actual final archive as well as tracked files.
- [ ] Confirm hosted URL/build/runtime and authenticated smoke evidence; record the video using [DEMO_CHECKLIST.md](DEMO_CHECKLIST.md), fill actual time/model confirmation in [DEVELOPMENT.md](DEVELOPMENT.md), share private demo access separately and submit to the author’s required destination/deadline.

Official configuration sources were consulted on 2026-11-19. Settings above are a checklist for the authorized deployment actor, not assertions about an existing Vercel/Supabase deployment.
