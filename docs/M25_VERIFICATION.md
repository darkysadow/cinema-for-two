# M2.5 verification record

This record covers Catalog Discovery only. The human approved implementation and the three defaults on 2026-11-19: Top rated requires 100 votes, Newest uses the server UTC calendar date, and accumulated results are capped at five API pages. See `PROJECT_SPEC.md` for the requirements and explicit supersession of the earlier catalog restrictions.

## Live TMDB evidence

The main session made read-only authenticated requests to the real TMDB API on 2026-11-19, separately from application mocks. The sandbox network attempt failed; the authorized network-enabled shell requests succeeded. Credentials were loaded privately from the existing local environment and were not printed. No hosted settings or data were modified.

| Request | Observed result |
| --- | --- |
| `/3/genre/movie/list?language=en` | HTTP 200; 19 movie genres; ID 35 maps to Comedy. |
| `/3/discover/movie` with `with_genres=35`, `sort_by=popularity.desc`, pages 1 and 2 | HTTP 200; 20 movies per page; every sampled movie's `genre_ids` contains 35. |
| `/3/discover/movie` with `with_genres=35`, `sort_by=vote_average.desc`, `vote_count.gte=100`, pages 1 and 2 | HTTP 200; 20 movies per page; every returned movie has Comedy and at least 100 votes. |
| `/3/discover/movie` with `with_genres=35`, `sort_by=primary_release_date.desc`, `primary_release_date.lte=2026-11-19`, pages 1 and 2 | HTTP 200; all 40 movies have Comedy and nonempty dates no later than the cutoff; dates descend within and across these pages. |
| `/3/search/movie` with `query=Inception`, page 1 | HTTP 200; 12 results, including movie 27205; no genre, Browse sort, vote-floor, or release-cutoff parameters sent. |

Movie requests also used `language=en-US` and `include_adult=false`. This sample establishes real endpoint filtering and constraints; it does not prove every catalog query or any browser interaction.

**Upstream ordering limitation:** Popular and Top rated returned some within-page numerical inversions despite the correct descending `sort_by` request. A repeat read confirmed, for example, Popular movie 891621 (75.1792) preceding 26817 (78.9041), and Top rated movie 13 (8.462) preceding 120301 (8.5). The page-1/page-2 boundaries were descending in this sample. The application must preserve TMDB order, as specified, rather than locally re-ranking a page. Strictly descending observed Popular/Top rated values are therefore not claimed verified. Data and ranking may change between visits.

## Application checks

| Check | Actual outcome |
| --- | --- |
| `npm run lint` | Passed in Builder and main sessions. |
| `npm run typecheck` | Passed in Builder and main sessions. |
| `npm test` | Passed after fixes. Main-session rerun with subprocess permissions reported **33 individual tests passed**, including 7 new catalog cases and 2 new controller regressions. The earlier restricted runs reported only passing file subprocesses; the full individual-case result is the stronger evidence. Existing fixture tests emitted missing-auth and deliberately blocked development-origin warnings without failures. |
| `npm run build` | Attempted in Builder and main sessions; failed with Turbopack's internal subprocess port-bind `EPERM` while processing CSS, including permission-enabled attempts. This default build is not claimed passed. |
| `npm run build -- --webpack` | Passed in the main session before and after the confirmed fixes, including compilation, TypeScript, page generation, and build traces. Builder's earlier restricted fallback had failed parsing TypeScript `--showConfig`; the successful main runs supersede that blocker. No dependency/configuration changes were used. |
| Production server | The successful Webpack output runs locally on port 3105 with TMDB fixtures, and separately on port 3106 with the existing live TMDB environment. |
| Browser build credential check | Scanned all 26 files in the final `.next/static` output for the configured TMDB credential; zero matches. This check does not claim an audit of every runtime log or private workflow. |

The seven new unit/adapter cases cover URL normalization and bounds, mode transitions, TMDB endpoint/parameter construction, genre outages, sort constraints with an injected UTC clock, merge/deduplication, and bounded range/retry orchestration. Two controller tests exercise the real React catalog in the existing jsdom setup, covering failed new transitions/retry and stale server props/uncached history restoration/failure/reset. These tests use mocked reads and establish no live-service or browser result. Lint and typecheck were rerun after the fixes and passed.

### Live application HTTP checks

Main-session read-only requests against the production app on port 3106 returned HTTP 200 and `Cache-Control: private, no-store`:

- `/api/catalog?genre=35&sort=rating&page=2`: Browse, Comedy, Top rated, highest page 2, 40 movies, 19 genres, no failed page.
- `/api/catalog?genre=35&sort=newest&page=2`: Browse, Comedy, Newest, highest page 2, 40 movies, UTC cutoff `2026-11-19`, no failed page.
- `/api/catalog?q=Inception&genre=35&sort=rating&page=1`: normalized Search state for Inception without Browse fields, 12 movies, terminal result, no failed page.

These exercise the real application adapter and range response separately from the direct API evidence above. They do not by themselves verify controls/history or signed-in private workflows.

### Browser checks

QA and main-session attempts to use the integrated Playwright MCP launcher both failed before navigation because its headed Chrome lacked usable X server/DISPLAY access. QA then launched the **already-installed Playwright MCP package with explicit headless/isolated options**; real Chrome navigation succeeded. No dependencies or browsers were installed. The launcher failure is not treated as browser testing being unavailable.

**Main-session live application browser checks passed** in isolated headless Chrome through Playwright MCP against port 3106, at 390×844:

- Default Browse showed 20 live movies with All genres/Popular. Selecting Comedy and each of Popular, Top rated, and Newest updated the actual controls, applied labels, URL, and movies; Top rated displayed its 100-vote explanation and Newest its UTC explanation.
- Load more changed Comedy/Top rated from page 1/20 cards to page 2/40 cards and retained the first movie. Browser network evidence showed one `x-catalog-read: page` request for page 2, returning 20 movies, rather than a range refetch.
- Reloading page 2 reconstructed 40 cards. Back restored page 1/20 cards; Forward restored page 2/40 cards with matching genre/sort controls. Forward reused the public page-local snapshot in this sample.
- Submitting padded `Inception` produced `/?q=Inception&page=1`, 12 results, and no Browse comboboxes. Back to Browse returned to All genres/Popular/page 1.
- Document scroll width equaled viewport width (390px) at every captured step; the main session visually inspected a live mobile screenshot. This is layout evidence, not a screen-reader audit.

After the history fixes, the main session also retested the **live** appended-movie journey at 360×800: Comedy/Top rated page 2 showed 40 cards; opening the appended movie *Love Untangled* (`/movies/1355666`) showed its details and signed-out save link. Back restored the same page-2 URL, 40 cards, Comedy and Top rated controls. Forward to details and Back again preserved that range. Document width remained 360px. These live-service browser outcomes do not establish deterministic error/retry behavior.

**Independent QA: all 15 grouped fixture browser scenarios passed on the final rebuilt production app**, through the installed headless Playwright MCP:

| Group | Observed outcome |
| --- | --- |
| Normal controls/modes | Real genre and all three sort controls updated the URL/results; title Search hid Browse controls; explicit/blank return and Reset restored default Browse. Mixed/repeated/invalid/oversized URL cases normalized as specified. |
| Accumulation/history | Load more requested only the next page; overlap deduplicated by first occurrence. Search pages 1–3 reloaded as nine fixture cards. Browse/Search Back/Forward reused matching snapshots without new API calls in the sampled sequence. |
| End/empty/cap | Five-page cap, API terminal page, duplicate-only page, raw empty next page, empty Search, and malformed pagination metadata behaved distinctly and preserved API order. |
| Pagination failures | A delayed page-2 failure retained three cards, page 1, focus, and announced error; pending controls exposed busy/disabled state and repeat Enter did not duplicate requests. Retry requested only page 2 and produced six cards. A direct page-4 request failing at page 3 corrected to page 2; Retry requested page 3 only. |
| Recovery/stale requests | Page-1 failure recovered on retry; a delayed Browse result did not replace newer Search. Failed new Search transport retained the committed canonical Browse URL/controls/cards, then Retry committed Search correctly. |
| Cross-route/history defects | Appended details → Back restored the same six IDs at page 2 with zero catalog API reads in QA's sample; further Back/Forward through page 1/page 2/details stayed consistent. Failed uncached history restoration showed a neutral Catalog shell without stale controls/cards; Retry reconstructed the requested range without adding history entries. |
| Mobile/accessibility | 360px and 390px had no horizontal overflow, including a 200-character search. Genre/Sort names appeared correctly in Chrome's accessibility tree. Selects/Search measured 48px high, Reset/Load more 44px. Keyboard Tab/focus and Enter submission worked at both widths. Loading/busy/error live-region markup was observed; actual screen-reader announcements were not tested. |
| Existing public routes | Signed-out appended movie details and the Watchlist sign-in redirect worked. This does not establish signed-in save/remove or Cinema for Two flows. |

A separate **cold genre-outage fixture** also passed: opening a requested genre/page-3 URL with unavailable genres explicitly fell back to All genres/Top rated/page 1 with three useful cards and a disabled labeled genre control. Search remained available. Recovering the local fixture and using Retry genres restored options without silently reapplying the removed genre.

Fixture failures were injected only through local mock controls or browser interception of localhost requests; hosted services were not modified. Normal flow had no browser JavaScript exceptions; deliberately aborted requests produced expected network console errors. QA left the local failure controls cleared. Temporary scripts, screenshots, and case logs are under `/tmp/cinema-m25-qa.JN26ea` (temporary evidence, not a project dependency): `catalog-{normal,faults,details-history,failed-popstate}-final.log`, `catalog-360.png`, `catalog-390.png`, `live-390.png`, and `live-final-360.png`.

## Independent review and fixes

Reviewer independently inspected the full initial M2.5 diff, including all untracked files, and confirmed two defects in isolated headless Chrome. Both were reported to the human before Builder was asked to fix them:

1. **High — details Back restoration (M25-AC-08, M25-URL-06, M25-AC-11):** Drama Popular page 1 → Load more/page 2 (six fixture cards) → open the last appended movie → wait for details/sign-in link → Back. The catalog briefly restored page 2, then replaced it with page 1 and three cards. The mount effect applied stale initial server props to the restored history entry.
2. **Medium — failed navigation state mismatch (M25-AC-03/04/08, M25-URL-01/05/06):** intercept only the same-app Inception range request with a local transport failure, then submit Search from Browse. The URL advanced to noncanonical `/?q=Inception` while the Browse heading/filters remained visible with the error. QA independently reproduced this; removing the fixture failure allowed retry to succeed.

Builder corrected both within the catalog controller and added regression coverage using the existing test setup. Failed new transitions retain the committed URL/cards and store their retry intent. Uncached history restoration hides stale controls until resolution, and original requested server parameters distinguish fresh rendering from stale server props after a details visit. The final 33-test suite and QA's browser retests passed; the main session independently retested the details journey with live TMDB. The earlier passing checks did not establish that these defects were absent.

**Follow-up independent review passed:** Reviewer reread the final tracked/untracked diff and new controller tests, independently reran both controller cases and `git diff --check`, and verified all three recovery journeys in headless Chrome with browser-only local 503 interception. Details Back/Forward preserved page 2/six cards; failed new Search preserved the canonical Browse URL/cards/history length and retry added exactly one Search entry; failed uncached history showed a neutral shell and retry restored controls/results without pushing. No additional blocking findings remained in that review. Hosted authorization and signed-in workflows remain outside this evidence.

Reviewer found no additional blockers in the initial source review. It checked server-only TMDB requests, genre validation, Search separation, page bounds, sort constraints, partial pagination/retry, public-only caches, and unchanged auth/domain/migration/dependency files. Direct compiled catalog (7) and Cinema (8) cases passed. Source inspection and these tests do not establish live hosted authorization.

## Retained limitations

This work does not provision accounts, alter authentication or database policies, apply migrations, change hosted settings, deploy, commit, push, or begin M3. Existing README limitations for M1/M2 remain in force unless an actual check here establishes otherwise: isolated PostgreSQL fixtures do not prove configured Supabase Auth/PostgREST behavior; hosted A/B Watchlist isolation and Cinema for Two browser/hosted flows remain unverified. The previously recorded dev-only invalid movie ID issue and tunnel/hydration incident are not resolved by catalog verification. Temporary local QA servers were stopped after the checks; the production build remains available through the normal local start command.

## Catalog card ratings follow-up — M25-AC-13

Browse and Search cards now use the existing normalized list rating for a one-decimal `TMDB 7.8/10` badge. The catalog list adapter treats numeric `vote_count: 0` as unrated; unavailable averages also display `TMDB Not rated`. A valid average of zero with votes displays `TMDB 0.0/10`. The shared movie normalizer, details reader, filters, ordering, pagination logic, Watchlist, schema, and dependencies were not changed for this display update. No per-card details fetch was added.

The focused controller regression passes in both modes with fixtures for a rated average, zero votes despite a nonzero average, an unavailable average, a valid zero with votes, and zero average with zero votes. The first test run exposed a selector mismatch because the existing Link mock omits CSS classes; correcting the test selector resolved that test-only failure. Final checks passed: **34 individual tests**, lint, typecheck, `git diff --check`, and `npm run build -- --webpack`. The default Turbopack build limitation recorded above was not re-tested or changed.

Real production Chrome through the installed **headless Playwright MCP** passed Browse and Search at **360px and 390px**, using controlled local TMDB list fixtures. At every width/mode, initial cards showed `TMDB 7.8/10`, `TMDB Not rated`, and `TMDB 0.0/10`; badges were 12.8px, visible, and unclipped with document width equal to viewport width. Load more retained the original ordered links/badges and fetched only the next page, including an appended unavailable-rating case. No browser JavaScript exceptions occurred. Browse-360 and Search-390 screenshots were visually inspected. The integrated headed MCP launcher remained blocked by X server/DISPLAY access; no browser or dependency installation was needed for the headless MCP checks.

This follow-up's browser evidence uses mocked upstream list responses; it does not add new live TMDB, signed-in Watchlist, or hosted Cinema for Two verification. Temporary fixture, browser case, and four screenshots are under `/tmp/cinema-rating-qa-1zxp9xg6`.
