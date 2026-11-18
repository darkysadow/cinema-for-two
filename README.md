# Cinema for Two

Cinema for Two is a mobile movie catalog with a private Watchlist. TMDB supplies the movie data and ratings. The current milestone covers the catalog, search, details, email/password sign-in, and saved movies. See [PROJECT_SPEC.md](PROJECT_SPEC.md) for the acceptance criteria.

## Run M1 locally

Use Node.js 22 and npm. Run `npm ci`, then copy `.env.example` to `.env.local` and configure:

| Variable | Value |
| --- | --- |
| `TMDB_READ_ACCESS_TOKEN` | TMDB API read access token. The app uses it only on the server. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL of the Supabase project for this environment. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable or legacy anon key from the same project. |

Use a Supabase project with email/password sign-in enabled and public registration disabled. Through the project’s Auth admin interface, create and confirm two distinct demo email/password accounts. Keep their credentials private. The app uses the publishable key and signed-in user’s session for Watchlist operations. Account usernames and the invitation destination are part of later milestone setup.

Apply [the Watchlist migration](supabase/migrations/20261118000100_create_watchlist.sql) to the chosen project before testing saves. The migration creates one private table with owner-based row-level security and a unique owner/movie key. Hosted settings and migrations were left untouched. The project owner should approve and apply the migration through their established workflow. Start `npm run dev` and open `http://localhost:3000`.

## Verify M1

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. The tests cover TMDB normalization, the local sign-in return-path allowlist, and forwarding Supabase auth cookies with cache-prevention headers on both continuing responses and redirects. The same four gates are defined in GitHub Actions.

1. At 360px and 390px, open the catalog signed out. Check popular titles, title search, whitespace returning to popular, and a no-match result. Open details and verify the labeled TMDB rating, overview, and poster or fallback. Confirm an invalid movie ID shows not-found feedback. Simulate an unavailable TMDB response to exercise retry separately from an empty list.
2. Open a movie and choose **Sign in to save**. Check the invalid-password error, then sign in with demo account A and verify the return to that movie. Save it, refresh, sign out, and sign back in. The item should still be present once. Open it from the Watchlist and remove it. Verify the empty state and that signing out blocks private data and leaves the catalog and details available.
3. Use separate browser sessions for demo accounts A and B with distinct test movies. Each Watchlist should show only the signed-in account’s movie. Verify a save action with extra owner or snapshot fields still uses the authenticated identity and TMDB data. For direct data checks, use each demo user’s ordinary Supabase session and the project publishable key. Check own list, read, insert, duplicate insert, and delete as controls. Check that the other owner’s rows cannot be listed or read, that inserting for the other owner fails, that updating or transferring ownership fails, and that deleting the other owner’s movie affects zero rows. Verify the rightful owner’s record afterward. An anonymous client should be unable to read or write Watchlist records. Use disposable demo rows throughout.

Local verification passed lint, typecheck, tests, and the default production build with `npm run build`. Production HTTP checks used mocked TMDB responses to verify catalog, search, details, retry responses, login targets, and the signed-out Watchlist redirect. Live TMDB and the interactive mobile flow were not exercised.

The SQL policies and grants were exercised in isolated PostgreSQL 16 against test `authenticated` and `anon` roles and a fixture `auth.uid()`. Own operations and duplicate inserts succeeded, and foreign or anonymous operations did not modify the other owner’s rows. A hosted Supabase/PostgREST check still needs the configured project, applied migration, and demo accounts. The return path validator includes the reserved session path shape. The end-to-end invitation return and destination authorization are deferred to M2.
