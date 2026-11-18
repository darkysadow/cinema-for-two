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
| OPEN-01 | Which deployment provider and authorized deployment actor will be used? Resolve during M3 planning, accounting for the existing agents' no-deploy instruction. |
| OPEN-02 | Which two demo usernames/accounts and private credential handoff channel will be used, and who provisions Supabase/TMDB access? External service/account status is unknown; resolve setup ownership before dependent implementation checks. Never paste secrets into this specification. |
| OPEN-03 | What assignment-specific submission destination, deadline, or video-length limit applies, if any? None was supplied; do not invent one. |

Specification task boundary: create/edit only `PROJECT_SPEC.md`; no application implementation, dependency installation, external service configuration, migrations, commits, pushes, deployments, or subagents.
