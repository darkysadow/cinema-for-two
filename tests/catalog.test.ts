import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendCatalogMovies,
  catalogHref,
  catalogParamsFromRecord,
  catalogSearchHref,
  defaultBrowse,
  isTerminalCatalogPage,
  normalizeCatalogParams,
} from "../lib/catalog";
import { createCatalogReader, parseCatalogGenres, parseCatalogPage } from "../lib/catalog-tmdb";
import { normalizeMovie } from "../lib/movies";

const comedy = { id: 35, name: "Comedy" };
const drama = { id: 18, name: "Drama" };
const genres = [comedy, drama];

function normalize(query: string) {
  return normalizeCatalogParams(new URLSearchParams(query), genres);
}

function rawPage(page: number, ids: number[], totalPages = 6) {
  return { page, total_pages: totalPages, total_results: totalPages * 20, results: ids.map(id => ({ id })) };
}

function requestParams(path: string) {
  return new URL(path, "https://example.test").searchParams;
}

test("catalog-url-normalization canonicalizes first values, known keys, and page bounds", () => {
  const input = catalogParamsFromRecord({
    sort: ["rating", "newest"], genre: ["35", "18"], page: "4", arbitrary: "ignored",
  });
  const normalized = normalizeCatalogParams(input, genres);
  assert.equal(catalogHref(normalized.state), "/?genre=35&sort=rating&page=4");
  assert.deepEqual(normalize(catalogHref(normalized.state).split("?")[1]), normalized);
  for (const page of ["", "0", "02", "-3", "4.2", "2\n", "word"]) {
    assert.equal(normalize(new URLSearchParams({ page }).toString()).state.page, 1);
  }
  const capped = normalize(`page=${"9".repeat(1800)}`);
  assert.equal(capped.state.page, 5);
  assert.match(capped.notices[0], /limited to page 5/);
  for (const genre of ["036", "-35", "35.0", "35,18", "35|18", "0", "91", "2147483648"]) {
    const invalid = normalize(new URLSearchParams({ genre, sort: "newest", page: "4" }).toString());
    assert.equal(catalogHref(invalid.state), "/?sort=newest&page=1");
    assert.match(invalid.notices[0], /genre isn’t available/);
  }
  const badSort = normalize("genre=35&sort=constructor&page=5");
  assert.equal(catalogHref(badSort.state), "/?genre=35&sort=popular&page=1");
  assert.match(badSort.notices[0], /sort isn’t available/);
});

test("catalog-mode-transitions give title search precedence and reset blank or invalid submissions", () => {
  assert.deepEqual(normalize(""), { state: defaultBrowse(), notices: [] });
  assert.deepEqual(normalize("q=+++&q=Inception&genre=35&sort=rating&page=3").state, defaultBrowse());
  assert.equal(catalogHref(normalize("q=+Inception+&genre=000&sort=rating&page=3").state), "/?q=Inception&page=3");
  const submit = catalogSearchHref(" Batman & Robin ");
  assert.equal(catalogHref(normalize(submit.split("?")[1]).state), "/?q=Batman+%26+Robin&page=1");
  for (const q of ["a".repeat(201), "🍿".repeat(201), "Bat\tman"]) {
    const invalid = normalize(new URLSearchParams({ q, genre: "35", page: "5" }).toString());
    assert.deepEqual(invalid.state, defaultBrowse());
    assert.match(invalid.notices[0], /up to 200/);
  }
  assert.equal(normalize(new URLSearchParams({ q: "🍿".repeat(200) }).toString()).state.mode, "search");
});

test("tmdb-discovery-request-contract builds server-side genre and search requests with no Browse leakage", async () => {
  const requests: string[] = [];
  const catalog = createCatalogReader(async path => {
    requests.push(path);
    return path.startsWith("/genre") ? { genres } : rawPage(Number(requestParams(path).get("page")), [1]);
  });
  const range = await catalog.readRange(new URLSearchParams("genre=35&sort=popular&page=2"));
  assert.deepEqual(range.genres, genres);
  assert.equal(requests[0], "/genre/movie/list?language=en");
  for (const [index, path] of requests.slice(1).entries()) {
    assert.match(path, /^\/discover\/movie\?/);
    assert.deepEqual(Object.fromEntries(requestParams(path)), {
      language: "en-US", include_adult: "false", page: String(index + 1),
      with_genres: "35", sort_by: "popularity.desc",
    });
  }
  requests.length = 0;
  await catalog.readRange(new URLSearchParams("q=+Batman+%26+Robin+&genre=35&sort=rating"));
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^\/search\/movie\?/);
  assert.deepEqual(Object.fromEntries(requestParams(requests[0])), {
    language: "en-US", include_adult: "false", page: "1", query: "Batman & Robin",
  });
  await catalog.readRange(new URLSearchParams());
  assert.equal(requests.length, 2, "reuse the still-valid genre mapping");
  assert.equal(requestParams(requests[1]).get("with_genres"), null);
  for (const invalid of [null, { genres: [] }, { genres: [comedy, comedy] }, { genres: [{ id: "35", name: "" }] }]) {
    assert.equal(parseCatalogGenres(invalid), null);
  }
});

test("genre-list outage permits search and unfiltered Browse without caching the failure", async () => {
  const requests: string[] = [];
  let genreReady = false;
  const catalog = createCatalogReader(async path => {
    requests.push(path);
    return path.startsWith("/genre") ? (genreReady ? { genres } : null) : rawPage(1, [1]);
  });
  const fallback = await catalog.readRange(new URLSearchParams("genre=35&sort=rating&page=3"));
  assert.equal(catalogHref(fallback.state), "/?sort=rating&page=1");
  assert.equal(fallback.genres, null);
  assert.match(fallback.notices[0], /couldn’t be applied/);
  assert.equal(requestParams(requests[1]).get("with_genres"), null);
  assert.equal(requestParams(requests[1]).get("vote_count.gte"), "100");
  requests.length = 0;
  await catalog.readRange(new URLSearchParams("q=Inception"));
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^\/search\/movie\?/);
  genreReady = true;
  assert.deepEqual(await catalog.genres(), genres);
});

test("tmdb-sort-constraints fix a single UTC cutoff for a range and apply votes only to Top rated", async () => {
  let now = new Date("2026-11-19T00:59:59+01:00");
  const requests: string[] = [];
  const catalog = createCatalogReader(async path => {
    if (path.startsWith("/genre")) return { genres };
    requests.push(path);
    now = new Date("2026-11-19T00:00:01Z");
    return rawPage(Number(requestParams(path).get("page")), [1]);
  }, () => now);
  const newest = await catalog.readRange(new URLSearchParams("sort=newest&page=2"));
  assert.equal(newest.cutoff, "2026-11-18");
  assert.equal(requests.length, 2);
  for (const path of requests) {
    const params = requestParams(path);
    assert.equal(params.get("sort_by"), "primary_release_date.desc");
    assert.equal(params.get("primary_release_date.lte"), "2026-11-18");
    assert.equal(params.has("vote_count.gte"), false);
    assert.equal(params.has("region"), false);
  }
  const next = await catalog.readPage(new URLSearchParams("sort=newest&page=3"));
  assert.equal(next.cutoff, "2026-11-19");
  assert.equal(next.page?.page, 3);
  await catalog.readPage(new URLSearchParams("sort=rating&page=2"));
  const rating = requestParams(requests[3]);
  assert.equal(rating.get("sort_by"), "vote_average.desc");
  assert.equal(rating.get("vote_count.gte"), "100");
  assert.equal(rating.has("primary_release_date.lte"), false);
});

test("catalog-page-merge keeps first IDs in API order, distinct from raw empty and invalid metadata", () => {
  const first = normalizeMovie({ id: 3, title: "Kept" })!;
  const duplicate = normalizeMovie({ id: 3, title: "Discarded" })!;
  const second = normalizeMovie({ id: 2, title: "Second" })!;
  assert.deepEqual(appendCatalogMovies([first], [duplicate, second, second]), [first, second]);
  assert.equal(isTerminalCatalogPage(parseCatalogPage(rawPage(2, [3]), 2)!), false);
  assert.equal(isTerminalCatalogPage(parseCatalogPage(rawPage(3, []), 3)!), true);
  assert.equal(isTerminalCatalogPage(parseCatalogPage(rawPage(3, [3], 3), 3)!), true);
  for (const input of [
    { results: [], total_results: 20, total_pages: 1 }, rawPage(2, []),
    { ...rawPage(1, []), total_pages: 1.5 }, { ...rawPage(1, []), total_results: -1 },
    { ...rawPage(1, []), total_pages: Number.MAX_SAFE_INTEGER + 1 },
    { ...rawPage(1, []), results: [{ title: "Missing ID" }] },
  ]) {
    assert.equal(parseCatalogPage(input, 1), null);
  }
});

test("catalog-bounded-range-recovery stops at the cap, API end, and first failure", async () => {
  const requested: number[] = [];
  let fail = 3;
  let total = 6;
  const catalog = createCatalogReader(async path => {
    const page = Number(requestParams(path).get("page"));
    requested.push(page);
    return page === fail ? null : rawPage(page, [2, page + 3], total);
  });
  const href = new URLSearchParams("q=Inception&page=12345678901234567890");
  const partial = await catalog.readRange(href);
  assert.deepEqual(requested, [1, 2, 3]);
  assert.equal(catalogHref(partial.state), "/?q=Inception&page=2");
  assert.deepEqual(partial.movies.map(movie => movie.id), [2, 4, 5]);
  assert.equal(partial.failedPage, 3);
  requested.length = 0;
  fail = 0;
  assert.equal((await catalog.readPage(new URLSearchParams("q=Inception&page=3"))).page?.page, 3);
  assert.deepEqual(requested, [3], "retry only the failed page");
  requested.length = 0;
  const capped = await catalog.readRange(href);
  assert.deepEqual(requested, [1, 2, 3, 4, 5]);
  assert.equal(capped.state.page, 5);
  assert.equal(capped.terminal, false);
  requested.length = 0;
  total = 2;
  const terminal = await catalog.readRange(href);
  assert.deepEqual(requested, [1, 2]);
  assert.equal(terminal.state.page, 2);
  assert.equal(terminal.terminal, true);
});
