# Cinema for Two

Cinema for Two is a mobile movie catalog with a private Watchlist and sessions for finding a movie two people want to watch. TMDB supplies the movie data and ratings. See [PROJECT_SPEC.md](PROJECT_SPEC.md) for the acceptance criteria.

## Run M1 locally

Use Node.js 22 and npm. Run `npm ci`, then copy `.env.example` to `.env.local` and configure:

| Variable | Value |
| --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | TMDB API read access token. The app uses it only on the server. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL of the Supabase project for this environment. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable or legacy anon key from the same project. |

Use a Supabase project with email/password sign-in enabled and public registration disabled. Through the project’s Auth admin interface, create and confirm two distinct demo email/password accounts. Keep their credentials private. The app uses the publishable key and signed-in user’s session for Watchlist operations. Follow [Set up M2](#set-up-m2) to assign the usernames for invitations.

Apply [the Watchlist migration](supabase/migrations/20261118000100_create_watchlist.sql) to the chosen project before testing saves. The migration creates one private table with owner-based row-level security and a unique owner/movie key. Hosted settings and migrations were left untouched. The project owner should approve and apply the migration through their established workflow. Start `npm run dev` and open `http://localhost:3000`.

## Verify M1

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. The tests cover TMDB normalization, the local sign-in return-path allowlist, and forwarding Supabase auth cookies with cache-prevention headers on both continuing responses and redirects. The same four gates are defined in GitHub Actions.

1. At 360px and 390px, open the catalog signed out. Check popular titles, title search, whitespace returning to popular, and a no-match result. Open details and verify the labeled TMDB rating, overview, and poster or fallback. Confirm an invalid movie ID shows not-found feedback. Simulate an unavailable TMDB response to exercise retry separately from an empty list.
2. Open a movie and choose **Sign in to save**. Check the invalid-password error, then sign in with demo account A and verify the return to that movie. Save it, refresh, sign out, and sign back in. The item should still be present once. Open it from the Watchlist and remove it. Verify the empty state and that signing out blocks private data and leaves the catalog and details available.
3. Use separate browser sessions for demo accounts A and B with distinct test movies. Each Watchlist should show only the signed-in account’s movie. Verify a save action with extra owner or snapshot fields still uses the authenticated identity and TMDB data. For direct data checks, use each demo user’s ordinary Supabase session and the project publishable key. Check own list, read, insert, duplicate insert, and delete as controls. Check that the other owner’s rows cannot be listed or read, that inserting for the other owner fails, that updating or transferring ownership fails, and that deleting the other owner’s movie affects zero rows. Verify the rightful owner’s record afterward. An anonymous client should be unable to read or write Watchlist records. Use disposable demo rows throughout.

Local verification passed lint, typecheck, tests, and the default production build with `npm run build`. Production HTTP checks used mocked TMDB responses to verify catalog, search, details, retry responses, login targets, and the signed-out Watchlist redirect. Live TMDB and the interactive mobile flow were not exercised.

The SQL policies and grants were exercised in isolated PostgreSQL 16 against test `authenticated` and `anon` roles and a fixture `auth.uid()`. Own operations and duplicate inserts succeeded, and foreign or anonymous operations did not modify the other owner’s rows. Live sign-in and Watchlist isolation still need verification against the configured Supabase project. The dev-only invalid movie ID issue remains unresolved.

## Set up M2

The project owner applies [the Cinema for Two migration](supabase/migrations/20261118000200_create_cinema_sessions.sql) after the Watchlist migration, using the same database owner. The three database functions run as that owner. The creation function explicitly filters Watchlist rows to the caller’s `auth.uid()`, and the read and vote functions require that actor to belong to the session. The owner needs access to create the M2 objects and reference Auth user IDs. Keep object ownership with the controlled migration role. The app uses the publishable key with ordinary user sessions.

From Supabase Auth’s admin interface, identify the existing Auth UUIDs for `alex` and `partner`. Using an administrator database connection configured privately with libpq, run this from the repository root. Substitute the actual UUIDs and your own database connection service name.

```sh
psql "service=cinema_admin" \
  -v alex_uuid='<Auth UUID for alex>' \
  -v partner_uuid='<Auth UUID for partner>' \
  -f supabase/provision-cinema-profiles.sql
```

The script uses the existing account IDs and assigns the two usernames in a transaction. An identical rerun succeeds and a conflicting mapping fails without changing existing profiles. Keep actual account details and credentials out of tracked files.

## Verify M2

Run the existing lint, typecheck, unit tests, and production build. To test the migration and database rules, run `bash tests/cinema-db.sh` with local PostgreSQL server tools available. It creates a disposable local cluster over a private Unix socket, uses fixture identities and ordinary database roles, and cleans up on exit. It covers grants and RLS, shortlist creation and rollback, fixed candidate order, own ballot visibility, result gating, invalid or repeated votes, concurrent submissions, no-match outcomes, and simulated nonmember access. This check does not exercise Supabase Auth, PostgREST, or browser behavior.

With approval for an isolated Supabase environment, use the publishable key and separate ordinary sessions for the host, invitee, a test-only nonmember, and anonymous requests. Check direct table reads, relationship reads, and RPCs before and after voting. Verify that anonymous users and nonmembers cannot read session data or submit, and that each participant can read at most their own raw ballot. Forbidden writes must not change any rows.

For browser checks, sign in as the host, save two or more movies, create a session, and copy its URL. Verify sign-in and return in a separate signed-out session, then repeat with a nonmember. Remove a shortlisted movie from the host’s Watchlist and check that it remains selectable in the session. With one vote in, inspect the waiting state and Refresh, including whether Refresh preserves the other participant’s draft. Exercise overlapping, disjoint, and intentional empty votes. Check results after a full reload and sign-out access at 360px and 390px. Browser and hosted checks remain pending.

## Run and verify M2.5 catalog discovery

Use the existing local setup and server-side `TMDB_READ_ACCESS_TOKEN`. M2.5 requires no new dependencies, environment variables, or database setup.

- Browse defaults to **All genres** and **Popular**. Choose one genre and sort by Popular, **Top rated** (at least 100 TMDB votes), or **Newest** (primary release date through today in server UTC). Changing either control starts at page 1. For example, `/?genre=35&sort=rating&page=1` opens Comedy sorted by Top rated.
- Search uses TMDB title matching at URLs such as `/?q=Inception&page=1`. Each submission starts at page 1 and clears Browse filters. A blank search, **Back to Browse**, or **Reset filters** opens default Browse.
- **Load more** adds the next page to the current results, up to five pages. A link ending in `page=3` opens pages 1 through 3, subject to availability. Reload and Back/Forward restore the selected mode and loaded range. TMDB results can change between visits. If a later page fails, the existing results stay visible and **Retry** requests the failed page.

`npm run lint`, `npm run typecheck`, and `npm test` passed during M2.5 implementation. The default Turbopack production build encountered a port binding restriction in the workspace. `npm run build -- --webpack` completed successfully. The final suite passed 33 tests, and headless Playwright MCP checks passed at 360px and 390px after two catalog navigation defects were reported and fixed. See [M2.5 verification](docs/M25_VERIFICATION.md) for separate live TMDB, local fixture/browser, review evidence, and retained verification limits.

## Diagnose Watchlist creation through a development tunnel

If checked movies still show a zero selection count, first check whether React has hydrated. The controls remain disabled with explicit loading feedback until hydration. The visible checkboxes stay outside the creation and remove forms. The creation form sends hidden movie IDs from the same selection state as the counter, so a rejected submission can preserve the shortlist for retry.

For ngrok development, allow only the exact hostname currently in the browser URL. Stop and restart the dev server with your own hostname in place of this placeholder:

```sh
DEV_TUNNEL_HOST=your-current-host.ngrok-free.dev npm run dev
```

Alternatively set `DEV_TUNNEL_HOST` in your untracked `.env.local`, then restart. Do not include `https://`, a port, path, wildcard, or multiple hosts. This setting is ignored in production and affects only Next development resources. Server Action origin validation and database access rules are unchanged. Update the value when the tunnel hostname changes.

The retained incident log showed an HMR origin rejection, and a local test of the installed React decoder showed that an undelivered development debug stream can block payload resolution. This is evidence for a hydration-stall mechanism, not a browser verification of this incident. Signed-out HTTP probes accepted localhost and matching synthetic tunnel headers; mismatched forwarded-host/origin headers were rejected before the action. Those probes did not invoke Supabase RPCs. An action log displaying FormData as `{}` alone does not establish that its fields were empty.

To capture a real attempt, enable Preserve log in DevTools Network, clear it, select three movies, and record the selection count and whether Create is enabled. Check JavaScript resource status/content type and the first hydration/chunk error. Record whether `/_next/hmr` upgrades successfully. If the count stays zero or controls stay loading and there is no `POST /watchlist`, the failure precedes the action and RPC.

If a POST appears, record its time, status or pending state, Origin, Content-Type, presence of Next-Action, candidateId field count (not the values), response Content-Type, and x-action-redirect. Correlate with the terminal's POST/action timing and any `x-forwarded-host`/`origin` mismatch, `Aborting the action`, or `Invalid Server Actions request` error. A 200 response can contain an inline validation/auth/RPC error; a redirect to `/sessions/...` indicates creation succeeded. The RPC is server-to-server, so it does not appear as a separate browser request. If needed, correlate the request time with Supabase API logs for `POST /rest/v1/rpc/create_cinema_session` and its status/error code. Share no cookies, Authorization values, credentials, raw form bodies, or raw ballots.

Transport/framework rejections now return inline feedback and settle the form's pending state; successful framework redirects are rethrown. A genuinely unresolved request is not force-timed-out or automatically retried. The pending view provides a full-page reload link; creation may already have completed, so do not assume a connection failure means no session was created.
