import {
  appendCatalogMovies,
  catalogHref,
  catalogTitle,
  isTerminalCatalogPage,
  MIN_RATING_VOTES,
  normalizeCatalogParams,
  type CatalogPage,
  type CatalogPageRead,
  type CatalogRange,
  type CatalogState,
  type MovieGenre,
} from "./catalog";
import { normalizeMovie, parseMovieId } from "./movies";

const genrePath = "/genre/movie/list?language=en";
const sortBy = {
  popular: "popularity.desc",
  rating: "vote_average.desc",
  newest: "primary_release_date.desc",
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseCatalogGenres(value: unknown): MovieGenre[] | null {
  const rows = record(value)?.genres;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const genres = new Map<number, MovieGenre>();
  for (const row of rows) {
    const genre = record(row);
    const id = typeof genre?.id === "number" ? parseMovieId(String(genre.id)) : null;
    const name = typeof genre?.name === "string" ? genre.name.trim() : "";
    if (id === null || !name || genres.has(id)) return null;
    genres.set(id, { id, name });
  }
  return [...genres.values()];
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseCatalogPage(value: unknown, requested: number): CatalogPage | null {
  const body = record(value);
  if (!body || body.page !== requested || !nonnegativeInteger(body.total_pages)
    || !nonnegativeInteger(body.total_results) || !Array.isArray(body.results)) {
    return null;
  }

  const movies = body.results.map(row => {
    const movie = normalizeMovie(row);
    // A list average with no votes is unrated, even when TMDB supplies a number.
    return movie && record(row)?.vote_count === 0 ? { ...movie, rating: null } : movie;
  }).filter(movie => movie !== null);
  if (body.results.length && !movies.length) return null;
  return {
    page: requested,
    movies,
    totalPages: body.total_pages,
    totalResults: body.total_results,
    empty: body.results.length === 0,
  };
}

function utcCutoff(state: CatalogState, now: () => Date): string | null {
  return state.mode === "browse" && state.sort === "newest"
    ? now().toISOString().slice(0, 10)
    : null;
}

function moviePath(state: CatalogState, page: number, cutoff: string | null): string {
  const params = new URLSearchParams({ language: "en-US", include_adult: "false", page: String(page) });
  if (state.mode === "search") {
    params.set("query", state.query);
    return `/search/movie?${params}`;
  }

  if (state.genre !== null) params.set("with_genres", String(state.genre));
  params.set("sort_by", sortBy[state.sort]);
  if (state.sort === "rating") params.set("vote_count.gte", String(MIN_RATING_VOTES));
  if (cutoff !== null) params.set("primary_release_date.lte", cutoff);
  return `/discover/movie?${params}`;
}

export function createCatalogReader(
  read: (path: string) => Promise<unknown>,
  now = () => new Date(),
) {
  // A single short-lived public genre mapping avoids repeated validation fetches.
  // Invalid responses are never cached, so a retry can recover immediately.
  let genreCache: { expires: number; genres: MovieGenre[] } | undefined;
  let genreRequest: Promise<MovieGenre[] | null> | undefined;

  async function genres(): Promise<MovieGenre[] | null> {
    if (genreCache && genreCache.expires > now().getTime()) return genreCache.genres;
    genreRequest ??= read(genrePath).then(parseCatalogGenres).then(value => {
      if (value) genreCache = { expires: now().getTime() + 5 * 60_000, genres: value };
      return value;
    }).finally(() => {
      genreRequest = undefined;
    });
    return genreRequest;
  }

  async function readPage(params: URLSearchParams): Promise<CatalogPageRead> {
    // Search and unfiltered Browse already contain all data needed to build a request.
    const needsGenres = catalogTitle(params).kind === "absent" && Boolean(params.get("genre"));
    const { state } = normalizeCatalogParams(params, needsGenres ? await genres() : null);
    const cutoff = utcCutoff(state, now);
    // If normalization changed the caller's requested state, let the catalog reconcile
    // the entire range rather than fetch a mismatched page for a stale filter.
    const page = catalogHref(state) === `/?${params}`
      ? await readMoviePage(state, state.page, cutoff)
      : null;
    return { state, page, cutoff };
  }

  async function readMoviePage(state: CatalogState, page: number, cutoff: string | null) {
    return parseCatalogPage(await read(moviePath(state, page, cutoff)), page);
  }

  async function readRange(params: URLSearchParams): Promise<CatalogRange> {
    const availableGenres = catalogTitle(params).kind === "search" ? null : await genres();
    const { state, notices } = normalizeCatalogParams(params, availableGenres);
    const cutoff = utcCutoff(state, now);
    const range: CatalogRange = {
      state: { ...state, page: 1 },
      genres: availableGenres,
      notices,
      movies: [],
      failedPage: null,
      terminal: false,
      cutoff,
    };

    for (let pageNumber = 1; pageNumber <= state.page; pageNumber++) {
      const page = await readMoviePage(state, pageNumber, cutoff);
      if (!page) {
        range.failedPage = pageNumber;
        break;
      }
      range.state.page = page.page;
      range.movies = appendCatalogMovies(range.movies, page.movies);
      range.terminal = isTerminalCatalogPage(page);
      if (range.terminal) break;
    }
    return range;
  }

  return { genres, readPage, readRange };
}
