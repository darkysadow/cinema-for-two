# Cinema for Two

A mobile movie-discovery app recreating the [IMDb](https://www.imdb.com/) discovery → details → Watchlist workflow. IMDb is the product reference, not an affiliate or data provider. Movie data and explicitly labeled ratings come from TMDB. The single added product feature, **Cinema for Two**, lets two assigned users privately vote on 2–5 movies from the host’s Watchlist, then see their shared choices.

Five page types: catalog `/`, details `/movies/[movieId]`, sign-in `/auth/login`, private `/watchlist`, and participant-only `/sessions/[sessionId]`. Scope and acceptance criteria: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Local setup

Use **Node.js 22.x and npm** (CI uses Node 22). Locked Supabase JS requires Node ≥22; Next requires ≥20.9. M3 checks ran on Node 23.8.0/npm 10.9.2, so a clean Node 22 install/build remains a handoff check. `package.json` has no `engines`/`packageManager` pin; use the committed npm lockfile, not dependency updates. Locked versions include Next 16.4.6, React 19.3.1, Supabase JS 2.119.1 and SSR 0.12.7.

```sh
npm ci
cp .env.example .env.local
# Fill .env.local privately, then:
npm run dev
```

Open `http://localhost:3000`. Never submit `.env.local`.

| Variable | Placeholder / intended exposure |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co`; public project URL, browser and server. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `your-publishable-or-anon-key`; public publishable/legacy anon key, browser and server. RLS and user sessions enforce access. |
| `TMDB_READ_ACCESS_TOKEN` | `your-tmdb-read-access-token`; secret, server only. Never prefix with `NEXT_PUBLIC_`. |
| `DEV_TUNNEL_HOST` (optional) | `your-current-host.ngrok-free.dev`; development only, one exact hostname without scheme, port, path or wildcard. Restart dev after changing it. Omit in production. |

No Supabase service-role/secret/admin key is required by the application. Administrator database access is needed only for owner-run setup, never as a deployment variable.

## Fresh Supabase setup

**Do not reapply these migrations to an already configured project.** First inspect the existing migration history, objects, policies and account mappings. These are fresh-setup instructions; no hosted setup was performed during M3 preparation.

1. In a new project, enable email/password Auth and disable public registration. Privately create and confirm two distinct demo accounts in Auth administration.
2. As the controlled database migration owner, apply once, in order: [Watchlist](supabase/migrations/20261118000100_create_watchlist.sql), then [Cinema sessions](supabase/migrations/20261118000200_create_cinema_sessions.sql). Keep ownership with that role; the M2 functions run as owner and enforce actor/membership explicitly. Use your established migration workflow; provisioning profiles is a separate step.
3. Obtain the two existing Auth UUIDs privately. Assign one account username **`alex`** and the other **`partner`**. Sign-in uses email/password; invitations use username. Emails, passwords and private access details are shared separately, never in this repository.
4. With an administrator connection configured privately through libpq, run:

```sh
psql "service=cinema_admin" \
  -v alex_uuid='<Auth UUID for alex>' \
  -v partner_uuid='<Auth UUID for partner>' \
  -f supabase/provision-cinema-profiles.sql
```

Alternatively, privately replace both marked UUID placeholders in [the SQL Editor template](supabase/provision-cinema-profiles-sql-editor.sql), then execute the whole transaction in Supabase SQL Editor. Do not save real IDs back to the template. Profile provisioning permits an identical rerun and rejects conflicting mappings; that does **not** make the migrations safe to rerun. Verify both accounts and username mappings against the intended project before a demo. Read-only M3 Auth/PostgREST checks confirmed the privately supplied **Person 1 → `partner`**, **Person 2 → `alex`** mapping; emails/passwords remain separate.

## Commands and discovery behavior

```sh
npm run lint
npm run typecheck
npm test
bash tests/cinema-db.sh
npm run build
# Explicit alternative build:
npm run build -- --webpack
npm start
```

The SQL test needs local PostgreSQL server tools (`pg_config`, `initdb`, `pg_ctl`, `psql`) and local Unix-socket permission. It creates and removes a disposable local cluster; it does not connect to Supabase. Do not run it as root. CI runs lint, typecheck, unit/DOM tests and the default build; SQL/browser checks are separate.

Browse supports one genre and Popular, Top rated (at least 100 votes), or Newest (primary release date through the server’s current UTC day). Example: `/?genre=35&sort=rating&page=1`. Search, such as `/?q=Inception&page=1`, uses title matching and clears Browse settings. Blank Search, Back to Browse and Reset filters return to All genres/Popular. Load more appends up to five API pages; reload and Back/Forward reconstruct that range. A failed later page preserves existing results and offers Retry for that page. Discovery adds no database setup.

## Verification and limitations

See the concise [verification matrix](docs/VERIFICATION.md) for current outcomes, [M2.5 evidence](docs/M25_VERIFICATION.md) for detailed historical checks, [development report](DEVELOPMENT.md), [Vercel checklist](DEPLOYMENT.md), and [video checklist](DEMO_CHECKLIST.md).

M3 is preparation only: public deployment and its authenticated smoke checks, video, actual time entry and submission remain manual. The matrix separates newly authorized local-app/hosted-backend checks from remaining privacy/tampering/nonmember coverage. Fixtures and isolated SQL tests do not establish hosted Auth/PostgREST behavior. The earlier dev-only invalid-ID issue is explicitly tracked in the matrix. Tunnel/hydration diagnosis and verification limits are retained in the development report.

TMDB data/ranking changes between requests; Popular/Top rated can contain numerical inversions despite the requested sort, and the app preserves upstream order. Results stop at five pages. Cinema uses explicit Refresh, immutable submitted ballots and no session history, realtime updates, public registration, recovery or OAuth. Browser evidence is not a screen-reader audit. Tracked browser artifacts/CLI linkage still need owner review before public submission; see the deployment checklist.
