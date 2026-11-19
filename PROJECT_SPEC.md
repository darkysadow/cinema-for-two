# Cinema for Two — Project Specification

Shared source of truth for the human, Builder, and Reviewer. **Confirmed** requirements come from the assignment; **proposals** require human approval before implementation. IDs remain stable when wording changes. This document specifies future work; it is not evidence that any behavior or check has been implemented or verified.

## Repository baseline (read-only inspection)

| ID | Observed state |
| --- | --- |
| BASE-01 | One Next.js App Router starter with TypeScript strict mode, Tailwind CSS 3, shadcn/Radix components, and Supabase browser/server clients and cookie-refresh proxy. `next.config.ts` enables `cacheComponents`. Package declarations use `latest` for Next.js and Supabase; installed versions and runtime compatibility were not verified. |
| BASE-02 | `/` is a starter/tutorial page. `/auth/login` provides email/password sign-in, currently redirecting to `/protected`. `/protected` displays auth claims and tutorial content, not a Watchlist. Sign-out scaffolding exists. |
| BASE-03 | Additional starter pages exist at `/auth/sign-up`, `/auth/sign-up-success`, `/auth/forgot-password`, `/auth/update-password`, and `/auth/error`; `/auth/confirm` is a route handler. These are not agreed MVP page types. |
| BASE-04 | `lib/supabase/proxy.ts` currently redirects unauthenticated requests outside `/` and auth paths. A future public movie-details route would be blocked. `app/auth/confirm/route.ts` passes its `next` parameter to a redirect without an allowlist. Both require resolution under M1. |
| BASE-05 | No movie integration, Watchlist/session domain code, database schema/migrations, test files, test runner, or CI workflow was found in the inspected repository. Supabase connection code references environment variable names, but external provisioning, credentials, demo users, policies, and deployment were not verified. No secret values were read. |
| BASE-06 | Scripts exist for `dev`, `build`, `start`, and `lint`; dedicated typecheck and unit-test scripts are planned. `.codex/agents/builder.toml` defines a Builder using `gpt-6.2-sol`/medium; `reviewer.toml` defines a Reviewer using `gpt-6.2-sol`/high. These files establish configuration, not evidence of agent execution. The README is still the Supabase starter README. |

## Confirmed scope and boundaries

| ID | Requirement / observable acceptance criterion |
| --- | --- |
| SCOPE-01 | Recreate IMDb's mobile movie-discovery and Watchlist workflows as a working mobile web app with at most five page types. A visitor can search, open details, sign in, and save a movie without using Cinema for Two. |
| SCOPE-02 | IMDb is the product reference; TMDB supplies movie data. The app does not imply IMDb affiliation. Displayed scores are explicitly labeled **TMDB rating**, never IMDb rating. |
| SCOPE-03 | Exactly one new product feature: **Cinema for Two**, in which two assigned users independently vote on a small shortlist from the host's Watchlist and see their shared choices. |
| TECH-01 | Use one Next.js App Router application with TypeScript and Tailwind. No NestJS, Turborepo, separate backend, WebSockets, or realtime infrastructure. |
| TECH-02 | Fetch TMDB movie data on the server; the credential is server-only, excluded from browser bundles, client responses, and logs. PostgreSQL stores user/domain records and minimal saved-movie metadata, not a duplicate movie catalog. |
| TECH-03 | Use Supabase Auth and PostgreSQL with user-scoped access and RLS where applicable. The application never uses a `service_role` key to bypass access policies. Authentication and authorization are enforced at data access and mutation boundaries, including direct authenticated database/API requests. |
| TECH-04 | Prefer Server Components for reads, Server Actions for mutations, and pure TypeScript functions for domain logic. Validate all mutation inputs on the server; derive the actor from verified authentication, never a supplied user ID. Shared caches must not expose personalized reads, ballots, or session results across users. |
| SCOPE-04 | Exclude registration, password recovery, OAuth, email invitations, friends, chat, reviews, trailers, recommendation engines, and AI features inside the app. Agent-assisted development and verification are required. |

## Five page types and milestone acceptance criteria

Routes already established for the root and sign-in are retained below. New domain paths are **proposal P-01**, since the starter establishes no movie, Watchlist, or voting routes. Query parameters and dynamic session/movie IDs do not create additional page types. Loading, errors, access denial, and not-found messages belong inside these page types or framework boundaries, not extra product pages.

| Page type | Route | Access | Milestone |
| --- | --- | --- | --- |
| Catalog and search | `/` (existing root, replace starter content); proposed `?q=...` | Public | M1 |
| Movie details | Proposed `/movies/[movieId]` | Public; Watchlist mutation requires sign-in | M1 |
| Watchlist | Proposed `/watchlist` | Signed-in owner | M1; session creation added in M2 |
| Cinema for Two | Proposed `/sessions/[sessionId]` | Only the assigned host and invitee, after sign-in | M2 |
| Sign-in | `/auth/login` (existing) | Public | M1 |

### M1 — IMDb core

Voting and session creation are not implemented in M1.

| ID | Observable acceptance criterion |
| --- | --- |
| M1-AC-01 | Opening the catalog without a nonblank search displays TMDB popular movies. Searching by title displays matching movies; each result opens that movie's details. Whitespace-only input returns to popular movies (proposed default P-02). |
| M1-AC-02 | Catalog/search shows a loading state while fetching, a distinct no-results state for a completed empty search, and a recoverable error with retry when TMDB fails. An empty popular response has an explicit empty state. API failures are not presented as no results. |
| M1-AC-03 | Details display title, poster or fallback, year, overview, and a labeled TMDB rating where available. Missing or malformed optional data renders defined fallbacks without crashing; unavailable ratings are not invented or converted to zero. Invalid/unavailable movie IDs show not-found feedback; upstream failures show an error and retry. |
| M1-AC-04 | Catalog and details open while signed out. Details offer a functional sign-in action to save a movie. Signed-in users can add/remove the movie from their own Watchlist and see the current saved state. Pending actions prevent accidental repeated mutation; failures show feedback without falsely indicating success. |
| M1-AC-05 | Watchlist displays only the current user's saved movies, including an empty state; items open details and can be removed. Saves persist after reload and a new sign-in. Re-saving the same movie does not create duplicates. Loading/read/write failures have visible feedback and a retry path. |
| M1-AC-06 | Email/password sign-in works for two pre-created demo accounts. Invalid credentials show an error, pending sign-in shows progress, and sign-out removes access to private pages. No public registration or recovery workflow remains exposed. Account provisioning is setup work, not an app feature. |
| M1-AC-07 | After sign-in, an invitee returns to the intended session. Return targets are validated against local product routes; external, protocol-relative, malformed, or unapproved targets fall back to Watchlist (P-03). Authorization is checked again at the destination; a return target grants no membership. |
| M1-AC-08 | User A cannot list, read, add, alter, or delete User B's Watchlist records using UI actions, tampered mutation payloads, or direct authenticated data requests. Anonymous requests cannot read or mutate Watchlists. |

### M2 — Cinema for Two

| ID | Observable acceptance criterion |
| --- | --- |
| M2-AC-01 | On Watchlist, a host selects 2–5 distinct currently saved movies and enters another existing user's username. Server validation rejects fewer/more candidates, duplicates, movies not owned by the host, unknown usernames, and self-invites. Failed creation leaves no partial session. Username matching follows P-04. |
| M2-AC-02 | Successful creation assigns exactly two different participants and produces a shareable session URL. The shortlist is fixed at creation: later Watchlist additions/removals do not change candidates or prevent voting. The URL alone never grants access. |
| M2-AC-03 | An unauthenticated invitee opening the URL is sent to sign-in with a safe return destination. Either assigned participant can view the fixed shortlist; another signed-in user receives no session metadata, candidates, submission status, votes, or results. Denial/not-found feedback follows P-05. |
| M2-AC-04 | Each participant privately selects the candidates they are willing to watch and explicitly confirms submission. Selections are restricted to the session's candidate IDs. A selection remains a draft until confirmed. Intentional empty votes and repeat submissions follow P-06; malformed payloads are rejected atomically. |
| M2-AC-05 | Until both participants submit, results are withheld at the data-access layer. The submitted participant sees a waiting state and an explicit **Refresh** action. The other participant can still vote. Refresh rereads persisted state without resetting an unsubmitted draft (P-07). No realtime connection is used. |
| M2-AC-06 | Once both submit, the same session page displays exactly the intersection of the two submitted selections. An empty intersection displays an explicit no-match state. Results remain available after reload. Result ordering follows P-08. |
| M2-AC-07 | Neither participant can obtain the other's raw selections through UI, HTML/serialized server payloads, Server Actions, direct table reads, database functions, or alternate data endpoints, before or after completion. Only shared matches become visible after both submit; coarse submitted/not-submitted status is allowed. |
| M2-AC-08 | Direct authenticated requests enforce participant membership, immutable candidates/participants, one ballot per participant, and candidate validation. Nonmembers cannot create ballots, submit as someone else, or compute results. Concurrent/retried submissions cannot create duplicates, leak partial results, or overwrite a confirmed ballot under P-06. |

### M2.5 — Catalog Discovery

**Approved scope extension; scheduled after M2 and before M3.** This extends the recreated movie-discovery workflow on the existing public catalog `/`, within the same five page types. Cinema for Two remains the single new product feature under SCOPE-03; discovery does not replace it or become a standalone feature. The human approved M25-P-01–03 on 2026-11-19 and authorized implementation of M2.5 only, using the existing stack/test setup without new dependencies unless separately approved. Approval does not establish implementation/verification evidence. M1/M2 requirements and their historical wording remain intact.

#### Explicit supersession and retained boundaries

| ID | Resolution |
| --- | --- |
| M25-SUP-01 | For M2.5 onward, supersede **only P-02's** “Fetch the first TMDB results page only; no pagination, filters, or sorting controls in this MVP” restriction with one genre selector, the three specified sorts, explicit Load more, Reset filters, and bounded URL-driven state. Retain P-02's trimming and movie-data fallbacks, including valid zero ratings. P-02 remains the recorded M1/M2 baseline, not a retroactively changed completion criterion. |
| M25-SUP-02 | Supersede **M1-AC-01's unconditional popular catalog when no nonblank query exists**: absence of a query now means Browse with validated URL genre/sort settings; All genres + Popular remains the default. Blank search submission still resets to that default. Title search and working movie-details links remain required. M1-AC-02's loading/empty/failure distinctions apply to both modes and are extended to pagination below. |
| M25-SUP-03 | No other existing requirement is superseded. Preserve M1/M2 scope, all authentication, safe-return and privacy boundaries, TECH-01–04, DATA-01–07, the five page types, and recorded verification limitations. No database/schema/migration changes, new authentication behavior, multi-select genres, advanced filter panels, infinite scrolling, or client-side filtering/sorting of one API page to simulate complete API results. No additional user filters for year, rating, votes, region, or release dates. |

#### Modes, endpoints, and exact sorting

Mode is derived from the normalized URL, not a separate `mode` parameter. With no non-empty trimmed title query, use **Browse**. With a non-empty trimmed title query, use **Search**. A genre selector offers **All genres** plus names/IDs fetched server-side from `GET /3/genre/movie/list`, in English. All genres means omit `with_genres`; one selected genre means exactly one validated TMDB ID, never a comma/pipe list. Server-side Browse requests use `GET /3/discover/movie`; Search uses `GET /3/search/movie` with `query`. Use `language=en-US` for movie requests and `include_adult=false` in both modes. Do not combine Discover parameters with title search.

| Browse label | URL `sort` | Required Discover request |
| --- | --- | --- |
| Popular (default) | `popular` | `sort_by=popularity.desc`; optional single `with_genres`. |
| Top rated | `rating` | `sort_by=vote_average.desc` and `vote_count.gte=100` under M25-P-01; optional single `with_genres`. |
| Newest | `newest` | `sort_by=primary_release_date.desc` and `primary_release_date.lte=YYYY-MM-DD` under M25-P-02; optional single `with_genres`. |

The vote-count floor applies only to Top rated; the future-release cutoff applies only to Newest. These are the minimum constraints needed to make those sorts meaningful, not additional controls. Preserve TMDB ordering, including its order for ties; do not locally re-rank results. Search uses TMDB's returned search order with neither Browse sort nor vote/date constraints. These endpoint/parameter choices follow the official [Discover movie reference](https://developer.themoviedb.org/reference/discover-movie), [movie genre reference](https://developer.themoviedb.org/reference/genre-movie-list), and [movie search reference](https://developer.themoviedb.org/reference/search-movie); reference inspection is not live API evidence.

**Approved defaults — M25-P-01–03 explicitly approved by the human on 2026-11-19:**

| ID | Approved default and consequence |
| --- | --- |
| M25-P-01 | Top rated requires **at least 100 TMDB votes** (`vote_count.gte=100`), reducing dominance by films with only a handful of votes. Display concise explanatory text with this sort. No adjustable vote-count control. |
| M25-P-02 | Newest uses the **server's current UTC calendar date**, formatted `YYYY-MM-DD`, inclusive, against **primary** release date. Compute once per range fetch and use the same cutoff for every fetched page; no region-specific date or browser-local date. Date-bearing cache entries include that UTC date and are not reused across its rollover. Undated films must not appear as newest; the upstream date constraint must establish eligibility, not local page filtering. |
| M25-P-03 | Maximum loaded page is **5** in both modes, counting API pages rather than unique movie count. A shared/reloaded URL can request at most pages 1–5. At page 5 disable/hide Load more and, if TMDB still reports more pages, explain “Showing the first 5 pages; refine your search or Browse settings.” If the API end is reached at or before the cap, show “No more results” instead. This deliberately limits depth even when TMDB has more results. No automatic scrolling fetches, background prefetch of further pages, or unbounded retry loop. |

#### URL contract and transitions

Retain the repository's root route and `q` convention. The complete allowed query-key set is **`q`, `genre`, `sort`, `page`**. Canonical URLs use `URLSearchParams` encoding and the following key order/shapes; omit `genre` for All genres and omit `q` entirely in Browse. Always serialize `sort` in Browse and `page` in both modes:

| State | Canonical example |
| --- | --- |
| Default Browse | `/?sort=popular&page=1` (`/` is a supported shorthand, normalized by replacement). |
| Genre + Top rated | `/?genre=35&sort=rating&page=1` (genre name comes from TMDB's mapping). |
| Accumulated Browse | `/?genre=35&sort=newest&page=3` means pages 1, 2, and 3 with those same settings. |
| Title Search | `/?q=Inception&page=1`; page 3 means search pages 1–3 for that title. |

`page=N` is the **highest successfully loaded API page in the accumulated range 1–N**, not a replacement page or a count of unique movies. Initial navigation to such a URL requests reconstruction of that range; failure/terminal reconciliation is defined below. This reconstructs the same page range and settings, not an immutable catalog snapshot: TMDB data/order and the UTC date can change between visits. No persistent snapshot or extra date parameter is introduced.

| ID | Normalization / navigation rule |
| --- | --- |
| M25-URL-01 | Decode through the framework's URL parser once. For repeated recognized keys use the **first occurrence**, matching the current `q` array convention; remove later occurrences. Drop all unknown keys without forwarding them to TMDB. Normalize to a single canonical URL with history **replace**, never a redirect loop or additional Back entry. Derive server requests and rendered controls from exactly this normalized state. |
| M25-URL-02 | Trim `q`; accept at most **200 Unicode code points** after trimming and reject remaining control characters (U+0000–001F, U+007F). An invalid/overlong query is cleared with visible feedback and resets to default Browse/page 1; do not truncate into an unintended search. A present but empty/whitespace-only `q` also resets to default Browse/page 1, ignoring stale genre/sort/page. With `q` absent, normalize Browse settings normally. |
| M25-URL-03 | A genre is absent/empty (All genres) or a canonical positive decimal integer, at most 2,147,483,647, present in the successfully fetched genre list. Reject zero, negative, leading-zero, fractional, nonnumeric, comma/pipe, or unknown IDs. Invalid nonempty genre becomes All genres/page 1 with visible feedback and the key removed; never label an invalid ID as an active valid genre. Sort is exactly `popular`, `rating`, or `newest`; missing/empty defaults to Popular, invalid nonempty values reset to Popular/page 1 with feedback. |
| M25-URL-04 | `page` is a canonical positive decimal integer. Missing/empty means 1; malformed, zero, negative, fractional, or leading-zero values become 1. A syntactically valid value above the approved maximum clamps to that maximum without unsafe integer parsing or any fetch above it; show cap feedback. Validation that resets a mode/filter takes precedence and forces page 1. Unknown-key removal alone does not reset a valid page. |
| M25-URL-05 | For a valid nonblank `q` on a directly opened URL, Search takes precedence: strip `genre` and `sort`, retain a validated `page`, and display no active Browse filters. The title-search form submits only `q` and starts at page 1, including re-submission. Genre/sort commits start a new Browse range at page 1. Reset filters clears genre and restores Popular/page 1; in Search it also clears `q` and returns to default Browse. An explicit **Back to Browse** action also returns to default Browse, never remembered Browse settings. |
| M25-URL-06 | Show labeled genre/sort selectors in Browse; hide them in Search and visibly identify Search plus its title. Browse visibly identifies its selected genre (or All genres) and sort. Pending edits do not claim to be applied results. Committed genre/sort changes, search submissions, resets, return-to-Browse, and successful Load more use history **push**. Canonical cleanup and terminal/partial-load URL correction use **replace**. Back/Forward restores the URL's mode, controls, query, and full accumulated page range, reusing matching public data or fetching it again as necessary. Never push during history restoration or mix old-mode results with restored controls. |

#### Accumulation, resilience, and smallest implementation change

On first open/reload/history restoration, fetch pages 1 through normalized N in API-page order, stopping at a terminal response or first failure. Load more requests only the next not-yet-loaded page for the active normalized state. Keep current results visible during pagination, prevent repeated pending requests, and ignore stale responses after mode/filter/history changes. Merge pages by movie ID, keeping the **first occurrence** and API order within each page and across pages. A duplicate-only page is not an empty API page and must not prematurely end pagination.

Successful Load more appends results and pushes the new highest page only after success, including a valid empty terminal response. Failure retains existing movies and the previous URL/page, announces an inline pagination error, and offers **Retry** for that same next page, not a full replacement of the catalog. On reconstruction failure at page K > 1, display pages 1–K−1, replace the URL's page with K−1, and offer retry of K. After success, the visitor may continue with Load more; do not silently queue the remaining original target range. A page-1 failure shows the catalog error/retry state and canonical page 1, without claiming any results were loaded. A successful empty first page shows a distinct mode-appropriate empty state.

Validate upstream `page`, `total_pages`, and `total_results` as nonnegative safe integers (`page` must match the requested positive page); missing/malformed pagination metadata is an API failure, not invented end-of-results evidence. Use valid `total_pages` and an empty **raw API results array** to detect the end; stop without requesting beyond the reported terminal page or M25-P-03. A successful empty page counts as loaded and ends the range. If an opened URL exceeds the reported total, fetch only the available range and replace its page with the last successfully loaded page (page 1 for zero results). Hide/disable Load more at the reported end or an empty page, and show end feedback. Fewer unique movies after normalization/deduplication alone does not prove the end. Preserve existing malformed-movie fallbacks/error handling.

Genre failure must not block Search or useful unfiltered Browse. Use a still-valid public cached genre list if available. Without a usable list, disable the labeled genre control with visible “Genres unavailable” feedback and retry; Browse uses All genres with the chosen valid sort. If the URL requested a genre, explicitly announce that it could not be applied, remove it, and reset to page 1 before rendering unfiltered results. Genre retry repopulates available choices but does not silently reapply a removed selection. Never present unfiltered results as genre-filtered. Search does not depend on genre lookup succeeding.

Read-only code context for the future implementer: `app/page.tsx` currently normalizes only `q`, renders a server `Results` list, and keys Suspense by query. `lib/tmdb.ts` currently selects `/movie/popular?page=1` or `/search/movie?...page=1`, returns only `Movie[]`, and deduplicates within that page; it uses server-only bearer auth and `cache: "no-store"`. `components/page-state.tsx` supplies loading/error states, but its error retry refreshes the route. M2.5 needs a small pure normalization/query/merge layer, genre lookup and a paginated adapter response retaining metadata, plus a thin catalog control/accumulation boundary using existing Next navigation and React state. Extend the existing page; a small server-side read boundary for incremental public movie data is allowed if needed and is not a new product page. Keep TMDB fetches server-side; do not prescribe a new state-management library, duplicate app, or complex architecture. Pagination retry must retain earlier pages rather than relying solely on the current whole-route error component.

Public genres and movie responses may be cached by normalized mode/query/genre/sort/API page/language and applicable UTC cutoff. Retaining `no-store` is also acceptable. Credentials remain server-only; do not expose them in browser requests, payloads, errors, or logs. Shared cache entries contain only public TMDB data, never auth/session data, Watchlist state, ballots, or personalized markup. Retain current details links, saved-state rendering, safe sign-in returns, and user-scoped Watchlist mutations.

#### Observable acceptance criteria

| ID | Observable acceptance criterion |
| --- | --- |
| M25-AC-01 | Browse defaults to All genres + Popular. The labeled selector maps TMDB movie genre names to their returned IDs. Selecting one genre sends that exact ID as Discover `with_genres`, resets to page 1, and displays the active name. Network/adapter evidence establishes real upstream filtering across pages; filtering one already fetched page fails acceptance. |
| M25-AC-02 | Popular sends `popularity.desc`, Top rated sends `vote_average.desc` plus the approved minimum votes, and Newest sends `primary_release_date.desc` plus the approved UTC cutoff. UI identifies the applied sort and its constraint. Request/response evidence verifies descending API ordering, vote eligibility, and exclusion of future dates; no client re-ranking or additional product filters. |
| M25-AC-03 | A trimmed title uses movie search only, strips Browse parameters, and hides Browse selectors/active labels. Submitting search clears prior Browse filters/page. Returning to Browse, Reset filters, or submitting an empty/whitespace query yields All genres + Popular/page 1. Direct mixed URLs follow M25-URL-05; title results never imply genre/sort constraints. |
| M25-AC-04 | URLs follow M25-URL-01–06, including repeated/unknown/malformed/overlong values, invalid genre feedback, query precedence, and the page cap. Genre/sort/query commits reset pagination; a valid directly opened URL preserves its requested bounded range. Controls, visible mode, canonical URL, and server request agree. |
| M25-AC-05 | Explicit Load more appends the next API page with the same mode/settings, preserves earlier cards, and advances the URL's highest page after success. Overlapping IDs appear once, first occurrence wins, API order is retained, and duplicate-only pages do not falsely terminate. No infinite scroll or concurrent duplicate click fetch. |
| M25-AC-06 | End-of-results and the configured cap both hide/disable Load more with distinct explanatory feedback. Crafted pages cannot cause more than the approved range of movie-page fetches per reconstruction. An out-of-range shared URL normalizes to the available range without requesting impossible pages. |
| M25-AC-07 | A later-page failure keeps existing cards and URL/page, provides announced inline Retry, and retries the failed page without duplicates. Reload/shared-URL partial failure follows the contiguous-prefix correction above. Page-1 loading/failure/retry and successful empty Browse/Search are visibly distinct. Stale responses cannot overwrite a newer discovery state. |
| M25-AC-08 | Reloading/opening `page=N` reconstructs pages 1–N, subject to terminal/failure rules. After load-more/filter/search/reset transitions, Back/Forward restores controls and accumulated results for each URL without mixed states or new history entries. Evidence acknowledges changing upstream data rather than promising identical movie snapshots. |
| M25-AC-09 | At 360px and 390px, labeled genre/sort/search controls, Reset filters, return-to-Browse, Load more, and Retry remain readable and operable without blocking horizontal overflow. Keyboard operation, visible focus, pending disabled controls, `aria-busy`, and announced loading/completion/error feedback work; pagination does not unexpectedly move focus or remove existing results. Active mode/filters are visible, not conveyed solely by color. |
| M25-AC-10 | Genre-list failure displays feedback and a usable retry, disables unavailable filtering, and retains Search and explicitly unfiltered Browse. Requested but unvalidated genres are not falsely shown as active. Movie failures are not mislabeled empty results or hidden by genre recovery. |
| M25-AC-11 | Movies from either mode and appended pages open the existing details page. Signed-out access/sign-in return and signed-in save/reload/remove continue working; user A cannot obtain B's private state. Cinema for Two shortlist creation, assigned-user voting, waiting/Refresh, immutable submissions, matches/no matches, and privacy keep their M1/M2 behavior. No new auth flow, tables, migrations, or additional page type. |
| M25-AC-12 | All TMDB requests use validated, bounded server parameters with no client credential exposure. Any shared cache holds public movie/genre data only and distinguishes relevant discovery state/date. Verification reports separately identify mock, live API, browser, and hosted-security evidence and all remaining limitations. |
| M25-AC-13 | Catalog cards in Browse and Search, including appended/reconstructed pages, show a readable TMDB badge at 360px and 390px. Reuse list-response ratings: format valid values to one decimal, e.g. “TMDB 7.8/10”; retain valid zero as “TMDB 0.0/10” when votes are present. Show “TMDB Not rated” when `vote_count` is zero or the rating is unavailable. No per-card movie-details request, database/schema change, or change to filtering, ordering, pagination, or Watchlist behavior. |

#### M2.5 test requirements (planned, not executed)

Use the repository's existing TypeScript/Node test conventions where applicable. Adapter fixtures are deterministic mock evidence; they do not establish real TMDB filtering or interactive browser behavior. Browser checks against mocks can demonstrate UI behavior but must be labeled as such. Live adapter checks do not establish keyboard/mobile/history behavior. Record each evidence category separately, with actual outcomes and environment; never infer hosted authorization from unit/UI tests.

| ID | Unique test name and planned coverage | Evidence required |
| --- | --- | --- |
| TEST-M25-U-01 | **catalog-url-normalization**: first repeated value, unknown-key removal, stable serialization, trim/control/200-code-point limits, numeric genre/page bounds, sort allowlist, cap, invalid-genre feedback, reset precedence, and canonical round trips. | Pure unit cases, including oversized crafted inputs and injected genre mappings; no network claims. |
| TEST-M25-U-02 | **catalog-mode-transitions**: absent versus blank versus nonblank `q`, mixed direct URL precedence, Search submit, genre/sort changes, Reset filters, return-to-Browse, and page resets. | Pure state/transition cases proving Search cannot retain Browse constraints. |
| TEST-M25-A-01 | **tmdb-discovery-request-contract**: genre endpoint parsing/name-ID mapping, Discover versus search endpoint, correct encoded query/page/single genre, default Popular and no unsolicited filters. Reject malformed genre and pagination payloads; cover genre failure fallback. | Mocked adapter requests/responses; inspect generated paths/parameters, never credentials. |
| TEST-M25-A-02 | **tmdb-sort-constraints**: all three exact `sort_by` values, approved vote floor only for rating, UTC primary-date cutoff only for newest, and neither constraint in Search. Inject clock near UTC midnight/timezone boundaries and prove one cutoff per reconstructed range. | Deterministic unit/adapter fixtures; no claim about live TMDB ranking. |
| TEST-M25-U-03 | **catalog-page-merge**: repeated IDs within/across pages, first-record retention, page/API order, duplicate-only pages, empty raw page, terminal metadata, and cap accounting by pages. | Pure merge/metadata cases with known expected IDs/order. |
| TEST-M25-A-03 | **catalog-bounded-range-recovery**: reconstruct 1–N, stop at totals/cap/first failure, keep contiguous prefix and failed-page retry, successful URL commit, invalid metadata, and ignore stale-state responses. | Mocked read orchestration/adapter cases; assert exact requested pages and no unbounded fan-out or automatic retry loop. |
| TEST-M25-B-01 | **catalog-controls-and-urls**: actual labeled controls, active Browse/Search display, each sort, one genre, reset/blank query/return, mixed and invalid URLs, keyboard submission and focus. | Browser observations of controls and URL transitions, with viewport and whether TMDB was mocked or live. |
| TEST-M25-B-02 | **catalog-pagination-and-history**: Load more, duplicate cards, pending click protection, end/cap, inline failure/retry without clearing cards, direct page-3 load/reload, partial reconstruction failure, Back/Forward, and stale responses during a mode change. | Controlled browser failure/duplicate fixtures plus recorded history/result behavior; do not call fixtures live API proof. |
| TEST-M25-B-03 | **catalog-mobile-and-resilience**: 360px/390px layouts, keyboard access/announcements, loading/empty/TMDB errors, genre failure/retry with and without requested genre, and useful Search/unfiltered Browse. | Actual browser/layout/accessibility observations at both widths; screenshots alone do not prove announcements or keyboard behavior. |
| TEST-M25-L-01 | **catalog-live-tmdb-evidence**: inspect actual genre name-ID mapping and real Discover requests/results for a selected genre across pages, each sort's order/eligibility, Newest cutoff, and separate title search. | Sanitized server request parameters and response fields (IDs, genre IDs, popularity/vote average/vote count/primary dates as relevant), UTC cutoff and time; redact credentials. Ties/dynamic changes are recorded, not locally re-sorted. If unavailable, mark pending; mocks/docs cannot substitute. |
| TEST-M25-R-01 | **catalog-core-regression**: details links from appended Browse/Search cards; signed-out/sign-in return; A/B save/reload/remove and isolation; M2 creation, waiting/Refresh, votes, matches/no matches; shared-cache privacy if caching is introduced. | Browser flows plus relevant existing auth/domain checks; direct authenticated Supabase checks remain separately required by TEST-I-01–05. Record unavailable accounts/hosted access as limitations. |

#### Implementation sequence and M3 follow-through

1. Plan M2.5 under FLOW-01; M25-P-01–03 and M2.5 implementation are explicitly approved by the human on 2026-11-19. Map work to M25 IDs and the supersession ledger. No reimplementation of M1/M2 or database work.
2. Add pure URL normalization/mode/query/merge logic and the paginated TMDB/genre adapter, retaining server-only credentials, existing movie normalization, and bounded fetches. Cover the planned unit/adapter cases using current tooling.
3. Extend the existing catalog's labeled controls, visible state, navigation/history, bounded accumulation, and inline retry; cover genre degradation, stale responses, loading/empty/end states and mobile/keyboard behavior.
4. Run relevant existing gates and planned M2.5 checks in the authorized environment. Record mock/live/browser/hosted evidence separately; review the actual diff under FLOW-02 and preserve unresolved limits. This sequence is a future plan, not executed work.

M3 must extend **M3-AC-01**'s smoke checklist with M25-AC-01–12 and TEST-M25-B/R cases, including both mobile widths and history/retry states; its original five-page and two-account checks remain. **HAND-01** setup/README should explain both modes, URL examples, approved defaults/cap, and retry/reset behavior without new database setup. **HAND-03**'s demo should show genre, each sort, search separation, reset and Load more within the recreated discovery flow, then retain Watchlist and both-participant Cinema for Two. **HAND-04/M3-AC-03** must record actual M2.5 evidence, superseded constraints, approved defaults, cap/dynamic-data limitations and pending checks. These are checklist additions, not claims that documentation, demo, deployment, or checks were completed here.

Recorded limits remain unchanged: README reports prior local gates and mocked production HTTP checks, but live TMDB and interactive mobile M1 flows were not exercised; isolated PostgreSQL fixture checks do not establish configured Supabase Auth/PostgREST or Watchlist isolation; M2 browser/hosted checks remain pending. The recorded dev-only invalid movie ID issue and tunnel/hydration incident's lack of browser verification remain unresolved. BASE-01–06 are the original read-only baseline, not current implementation claims; the M2.5 code observations above do not revise historical evidence or mark any milestone verified.

### M3 — Submission

| ID | Observable acceptance criterion |
| --- | --- |
| M3-AC-01 | Mobile smoke testing covers all five page types, both demo accounts, signed-out access, save/reload/remove, invite/sign-in/return, one-vote waiting and refresh, two-vote matches, intentional empty votes, and no matches. At 360px and 390px viewport widths (P-09), no horizontal overflow blocks use; labels, touch controls, focus, pending/error states, and keyboard form submission remain usable. No decorative control implies an unavailable action. |
| M3-AC-02 | A working deployment supports public TMDB reads and authenticated persistent writes. Both demo accounts and their usernames are verified there; deployed session links return correctly through sign-in. Actual deployment approval follows the workflow below. |
| M3-AC-03 | Submission includes every artifact in HAND-01–04, with reproducible setup and truthful check results, limitations, and agent-use evidence. Secrets and demo passwords are absent from the committed repository and public report. |

## Proposed defaults and data design — approval required

These choices fill gaps; they are not additional confirmed product features. Approval of a milestone plan must explicitly accept or revise its relevant proposals.

| ID | Proposal |
| --- | --- |
| P-01 | Use the routes in the page table. Replace the starter UI; retire `/protected` and the extra auth pages/confirmation handler so they do not expose additional workflows. Render auth errors within sign-in. Preserve cookie/session refresh while narrowing protected-route checks to Watchlist and sessions. |
| P-02 | Trim search input; blank means popular movies. Fetch the first TMDB results page only; no pagination, filters, or sorting controls in this MVP. Missing title: “Untitled movie”; missing year/overview/rating: explicit unavailable text; missing/broken poster: a local fallback. Preserve a valid numeric zero rating if supplied. |
| P-03 | Carry a local return target through sign-in. Allow only the agreed Watchlist route, a valid movie-details path, or a valid session path, with no scheme, host, backslash, nested redirect, or arbitrary query target. Reject unsafe decoded forms as well. Default to Watchlist. The session ID is opaque, not an authorization token. |
| P-04 | Assign each demo account a unique, immutable username during provisioning. Trim and compare usernames case-insensitively; resolve only an exact username through a restricted lookup returning the minimum ID/username, never email, auth metadata, or a user directory. Self-invites and unknown usernames produce inline errors. |
| P-05 | Missing and unauthorized sessions show the same generic unavailable message. Exactly two participants are assigned at creation; no reassignment, cancellation, expiry, or session-history page in this MVP. The host retains/copies the generated URL. |
| P-06 | Zero selected candidates is a valid intentional empty ballot. Show “Submit with no selections” clearly before confirmation. Confirmation freezes the ballot. An identical repeat returns the existing success; a changed repeat is rejected with “Vote already submitted.” Normalize choice order for equality; reject duplicate/noncandidate IDs. Empty selection counts as submitted and yields no matches when both finish. |
| P-07 | Keep unconfirmed choices in page memory only; a full browser reload may discard them. Explicit Refresh preserves the current draft while retrieving fresh submission/results state. Show only each participant's coarse submission status; never selection counts or partial matches. |
| P-08 | Store shortlist order at creation and display matches in that order. No ranking, tie breaker, automatic winner, or third voting round. |
| P-09 | Use 360px and 390px as minimum smoke-test widths and a narrow single-column layout, with larger screens remaining usable. |
| P-10 | Use the minimal model and database access design below. Choose the unit-test runner and deployment provider in the relevant milestone plan; neither is configured by this document. |

### P-10: Minimum persistent model

This is a conceptual design, not SQL or implementation code. Supabase Auth owns identities and passwords; no application table stores passwords or credentials.

| Record | Minimum fields and invariants |
| --- | --- |
| Profile | Auth user ID and unique normalized username for each pre-created account. No email or password in the app profile. |
| Watchlist item | Owner user ID, TMDB movie ID, saved timestamp, and minimal title/poster/year snapshot for rendering. Unique owner/movie pair. |
| Session | Opaque ID, host user ID, invitee user ID, creation timestamp. Nonnull, distinct, immutable participant IDs represent membership; no separate membership table is necessary for exactly two users. |
| Shortlisted movie | Session ID, TMDB movie ID, fixed position, and minimal title/poster/year snapshot copied at creation. Unique session/movie and session/position; exactly 2–5 per session. Independent of Watchlist rows after creation, with no cascading removal from Watchlist changes. |
| Ballot | Session ID, voter user ID, selected candidate movie-ID set, submitted timestamp. Unique session/voter pair. A persisted empty set represents a submitted empty ballot; absence of a ballot means not submitted. IDs must belong to that session's shortlist, and voter must be one of its two participants. No draft persistence. |

### P-10: Data-access rules and privacy boundary

| ID | Proposed enforcement / acceptance criterion |
| --- | --- |
| DATA-01 | Enable RLS on application tables. Anonymous roles have no access to private domain records or functions. Watchlist reads/inserts/deletes require authenticated user ID = owner; ownership cannot be reassigned. Profile access is limited to one's own profile plus P-04's exact-username lookup; public enumeration is denied. |
| DATA-02 | Session and candidate reads require membership. Creation occurs in one restricted database transaction: derive host from authentication, resolve invitee, validate ownership and distinct 2–5 candidates, and persist session plus snapshots together. Deny direct candidate/session edits and deletes that could change membership or shortlist after creation. |
| DATA-03 | Raw ballot reads are restricted by RLS to the authenticated voter who is still a session member, including after both submit. Participants cannot read each other's ballots. No broadly readable view, join, or status endpoint includes choice sets. Direct ballot writes are denied; a narrowly scoped transactional submission operation enforces membership, candidate validity, uniqueness, and P-06. |
| DATA-04 | A restricted database result operation verifies caller membership first, then checks for both persisted ballots in a consistent transaction/snapshot. It returns only coarse submission status and a waiting result until both exist; afterward it returns only the intersecting candidate IDs. It never returns the other ballot, choice counts, or nonmatching choices. Own-ballot reads do not authorize computing the other ballot on the client. |
| DATA-05 | Where database operations need access beyond the caller's raw-ballot visibility, use narrowly scoped database-owned functions with explicit authentication/membership checks, minimal privileges, fixed object resolution/search path, and restricted execution grants. Audit each such function as an authorization boundary. Do not widen ballot RLS or introduce an application `service_role` client. No general-purpose query or raw-ballot function is exposed. |
| DATA-06 | Transactions/constraints prevent partial creation and concurrent duplicate submissions. Invalid candidate IDs reject the entire submission. Guard direct authenticated database/API paths as well as Server Actions; hiding values in the UI or filtering a Server Action response alone does not satisfy privacy. |
| DATA-07 | Personalized server renders, data responses, errors, logs, and caches do not leak another user's Watchlist, auth claims, or ballots. Public TMDB caching may be shared; private reads use an authenticated request scope. Persist only the limited movie snapshots needed for saves and fixed sessions. |

## Verification plan (not execution evidence)

Unit tests use pure TypeScript domain functions; database authorization requires separate integration/manual checks. No tests were written, run, or claimed passed during specification work.

| ID | Planned unit tests | Rationale |
| --- | --- | --- |
| TEST-U-01 | Normalize TMDB responses with missing/null/empty optional fields, malformed dates, absent/broken poster references, and absent versus valid zero ratings. | External records vary; missing data must not crash rendering or misrepresent a score. |
| TEST-U-02 | With neither ballot or only one ballot submitted, return waiting without matches; distinguish an absent ballot from a submitted empty set. | Prevent premature results and the empty-vote deadlock. Unit tests alone do not prove database privacy. |
| TEST-U-03 | Given two ballots, compute the exact intersection for overlapping, identical, and disjoint selections; preserve shortlist order under P-08. | Verify the feature's central rule and deterministic output. |
| TEST-U-04 | Both disjoint ballots and any intentional empty ballot produce an explicit completed/no-match result after both submissions. | A completed session with no matches must differ from a waiting session. |
| TEST-U-05 | Under approved defaults, validate 2/5 boundaries, duplicates, noncandidate IDs, self-invites, order-independent repeated ballots, and allowed/rejected return destinations. | Cover domain and redirect boundaries susceptible to tampered input. |

| ID | Planned integration or manual check | Required evidence |
| --- | --- | --- |
| TEST-I-01 | As A, B, and anonymous, attempt direct Watchlist reads/writes with another owner's ID, including updates that reassign ownership. | Record allowed own operations and denied/empty unauthorized results using actual RLS-backed requests, not only UI observations. |
| TEST-I-02 | As host, invitee, nonmember, and anonymous, request session rows, candidates, status, results, and submission operations directly. Attempt participant/candidate changes. | Verify both authorized participants succeed and other callers obtain no private data or write capability. Use an isolated third identity for nonmember testing if necessary; no third demo account is required in the product. |
| TEST-I-03 | As each participant, read ballot tables and invoke every exposed function before/after both submit, including empty ballots. Inspect page/server payloads. | Own raw ballot may be readable; the other's raw ballot never is. Waiting reveals no intersection; completed result reveals only matches. Include direct authenticated data requests. |
| TEST-I-04 | Submit concurrent/repeated votes, changed repeats, forged voter IDs, invalid candidates, self-invites, and invalid shortlist sizes. Remove a shortlisted movie from Watchlist after creation. | Atomic rejection/idempotency as approved; no partial rows, duplicate ballots, overwritten votes, or shortlist changes. |
| TEST-I-05 | Exercise invite sign-in return, invalid credentials, sign-out, external/protocol-relative/encoded malicious return targets, and anonymous details access. | Valid local return works; unsafe redirects fail closed; public pages stay public and private pages remain guarded. |
| TEST-I-06 | Fail TMDB reads and omit optional movie fields; inspect browser responses/bundles and representative logs for credential exposure. Complete M3 mobile/deployment flows. | Capture visible fallbacks/retry behavior and actual outcomes without logging credentials or raw ballots. |
| CI-01 | Planned CI gates: lint, typecheck, unit tests, and production build. Add missing runner/scripts/workflow during approved implementation. | Record actual command, result, and relevant failures for each gate; missing tooling or unrun checks are reported explicitly. |

## Agent workflow and handoff

| ID | Required process or artifact |
| --- | --- |
| FLOW-01 | Builder reads this spec, proposes a plan for **one milestone**, maps work to requirement IDs and relevant proposals, and waits for human approval before implementing. After approval, implement only that milestone and report changed files, actual checks/results, and limitations. |
| FLOW-02 | A separate Reviewer reads this spec and the actual Git diff. Reviewer does not edit files; reports findings with requirement IDs, file locations, evidence, severity, and verification limits. The human decides which findings to fix and verifies the resulting changes. Do not treat an agent assertion as proof. |
| FLOW-03 | Keep a record of actual agent configuration, prompts/tasks, useful output, corrections, and human verification for the report. No subagents were spawned in this specification task. Existing agent instructions prohibit push/deploy; M3 therefore prepares a reviewable deployment and handoff, with the human or a separately authorized actor performing deployment. This spec does not override that restriction. |
| HAND-01 | Repository plus project-specific setup instructions: prerequisites, environment variable **names/placeholders only**, database/policy setup, demo-account/username provisioning, local run and check commands, and limitations. No real credentials in tracked files. |
| HAND-02 | Working deployed URL; demo usernames, emails, and passwords delivered separately through the agreed private handoff channel. Verify both accounts and invite URLs before submission; no credentials are invented here. |
| HAND-03 | Short video showing the original IMDb discovery/details/Watchlist flow, then the recreated flow, followed by Cinema for Two with both participants and results. Present IMDb as the reference and TMDB as the data provider. |
| HAND-04 | Development report covering API integration, privacy/data-access enforcement, actual agent setup and usage, test rationale and actual results, verification/correction of AI output, recorded time spent, and known limitations. Use real records; do not invent execution evidence or time estimates. |

## Conflicts and genuine open questions

| ID | Decision / resolution needed |
| --- | --- |
| DEC-01 | Approve or revise P-01–P-10 before their implementation. Key choices: new routes and removal of extra starter pages, immutable ballots with intentional empty votes, exact-username lookup, minimal storage/access design, and one results page without session history. |
| DEC-02 | Starter conflicts are explicit in BASE-02–04: extra auth workflows exceed the agreed scope, `/protected` exposes tutorial claims, the broad guard conflicts with public details, and the confirmation redirect lacks safe-target validation. P-01 proposes retiring unused paths rather than adding page types; M1 must resolve these before acceptance. No source was changed here. |
| DEC-M25-01 | M2.5's Catalog Discovery scope is approved after M2/before M3. M25-SUP-01–03 explicitly resolve P-02/M1-AC-01 conflicts; their historical wording is retained. The human explicitly approved M25-P-01 (100 votes for Top rated only), M25-P-02 (server UTC date cutoff for Newest), and M25-P-03 (5 loaded pages) on 2026-11-19 and authorized M2.5-only implementation, QA, and independent review. The URL contract, two-mode separation, and tests are specified above; no additional product decision is left open here. Existing OPEN-01–03 and recorded verification limits still apply. |
| OPEN-01 | Which deployment provider and authorized deployment actor will be used? Resolve during M3 planning, accounting for the existing agents' no-deploy instruction. |
| OPEN-02 | Which two demo usernames/accounts and private credential handoff channel will be used, and who provisions Supabase/TMDB access? External service/account status is unknown; resolve setup ownership before dependent implementation checks. Never paste secrets into this specification. |
| OPEN-03 | What assignment-specific submission destination, deadline, or video-length limit applies, if any? None was supplied; do not invent one. |

Specification task boundary: create/edit only `PROJECT_SPEC.md`; no application implementation, dependency installation, external service configuration, migrations, commits, pushes, deployments, or subagents.
