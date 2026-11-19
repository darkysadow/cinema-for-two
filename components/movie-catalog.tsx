"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  appendCatalogMovies,
  catalogHref,
  catalogSearchHref,
  catalogSort,
  catalogSorts,
  defaultBrowse,
  isTerminalCatalogPage,
  MAX_CATALOG_PAGE,
  MIN_RATING_VOTES,
  type CatalogPageRead,
  type CatalogRange,
  type MovieGenre,
} from "@/lib/catalog";
import { MoviePoster } from "@/components/movie-poster";
import { EmptyState, LoadingState } from "@/components/page-state";

type HistoryChange = "push" | "replace";
type Read = "range" | "page" | "genres";
type NavigationFailure = { href: string; change: HistoryChange };
const maxHistorySnapshots = 10;

function currentHref() {
  return window.location.pathname + window.location.search;
}

function sortedSearch(search: string) {
  const params = new URLSearchParams(search);
  params.sort();
  return params.toString();
}

function updateHistory(href: string, change: HistoryChange) {
  if (href === currentHref()) return;
  if (change === "push") window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
}

async function readCatalog<T>(kind: Read, href: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/catalog${new URL(href, window.location.origin).search}`, {
    headers: { "x-catalog-read": kind },
    signal,
  });
  if (!response.ok) throw new Error("Catalog unavailable");
  return response.json() as Promise<T>;
}

export function MovieCatalog({ initial, requestedSearch }: { initial: CatalogRange; requestedSearch: string }) {
  const [range, setRange] = useState(initial);
  const [queryInput, setQueryInput] = useState(initial.state.mode === "search" ? initial.state.query : "");
  const [pending, setPending] = useState<Read | null>(null);
  const [navigationFailure, setNavigationFailure] = useState<NavigationFailure | null>(null);
  const [viewMatchesLocation, setViewMatchesLocation] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const active = useRef<AbortController | null>(null);
  const snapshots = useRef(new Map<string, CatalogRange>());

  const commit = useCallback((next: CatalogRange, change: HistoryChange | null = null) => {
    const href = catalogHref(next.state);
    if (change) updateHistory(href, change);
    // The server is the source of truth for the UTC date, so history always rechecks Newest.
    if (!next.failedPage && !next.cutoff && (next.state.mode === "search" || next.genres)) {
      const history = snapshots.current;
      history.delete(href);
      history.set(href, { ...next, notices: [] });
      if (history.size > maxHistorySnapshots) {
        const oldest = history.keys().next();
        if (!oldest.done) history.delete(oldest.value);
      }
    }
    setRange(next);
    setViewMatchesLocation(true);
  }, []);

  const loadRange = useCallback(async (href: string, change: HistoryChange, restore = false) => {
    active.current?.abort();
    setNavigationFailure(null);
    setAnnouncement("");
    const cached = restore ? snapshots.current.get(href) : undefined;
    if (cached) {
      active.current = null;
      setPending(null);
      setQueryInput(cached.state.mode === "search" ? cached.state.query : "");
      commit(cached);
      setAnnouncement(`${cached.movies.length} movies restored.`);
      return;
    }

    const request = new AbortController();
    active.current = request;
    if (restore) {
      setViewMatchesLocation(false);
      setQueryInput("");
    }
    setPending("range");
    try {
      const next = await readCatalog<CatalogRange>("range", href, request.signal);
      if (active.current !== request) return;
      commit(next, change);
      setQueryInput(next.state.mode === "search" ? next.state.query : "");
      if (!next.failedPage) setAnnouncement(`${next.movies.length} movies loaded.`);
    } catch {
      if (active.current !== request) return;
      setNavigationFailure({ href, change });
    } finally {
      if (active.current === request) {
        active.current = null;
        setPending(null);
      }
    }
  }, [commit]);

  useEffect(() => {
    function restore() {
      if (window.location.pathname === "/") void loadRange(currentHref(), "replace", true);
    }
    // Next can restore the server payload for an earlier catalog URL after a details visit.
    // Native history contains the latest loaded page, so only normalize matching server data.
    if (sortedSearch(requestedSearch) === sortedSearch(window.location.search)) commit(initial, "replace");
    else restore();
    window.addEventListener("popstate", restore);
    return () => {
      active.current?.abort();
      active.current = null;
      window.removeEventListener("popstate", restore);
    };
  }, [commit, initial, loadRange, requestedSearch]);

  const { state } = range;
  const browse = viewMatchesLocation && state.mode === "browse" ? state : null;
  const search = viewMatchesLocation && state.mode === "search" ? state : null;
  const genreName = range.genres?.find(genre => genre.id === browse?.genre)?.name ?? "All genres";
  const capReached = state.page >= MAX_CATALOG_PAGE;
  const showResults = viewMatchesLocation && pending !== "range";

  async function loadMore() {
    if (active.current || range.terminal || capReached) return;
    const requested = { ...state, page: state.page + 1 };
    const href = catalogHref(requested);
    const request = new AbortController();
    active.current = request;
    setPending("page");
    setAnnouncement("Loading more movies…");
    try {
      const next = await readCatalog<CatalogPageRead>("page", href, request.signal);
      if (active.current !== request) return;
      const sameState = catalogHref(next.state) === href;
      if (!sameState || next.cutoff !== range.cutoff) {
        // A stale genre or UTC rollover requires a fresh consistent range.
        const refreshed = await readCatalog<CatalogRange>("range", href, request.signal);
        if (active.current !== request) return;
        if (refreshed.failedPage) throw new Error("Catalog unavailable");
        commit(refreshed, "push");
        setAnnouncement(`${refreshed.movies.length} movies loaded.`);
      } else if (next.page) {
        const movies = appendCatalogMovies(range.movies, next.page.movies);
        commit({
          ...range,
          state: requested,
          movies,
          failedPage: null,
          terminal: isTerminalCatalogPage(next.page),
        }, "push");
        setAnnouncement(`${movies.length} movies loaded.`);
      } else {
        throw new Error("Page unavailable");
      }
    } catch {
      if (active.current !== request) return;
      setRange({ ...range, failedPage: requested.page });
      setAnnouncement("");
    } finally {
      if (active.current === request) {
        active.current = null;
        setPending(null);
      }
    }
  }

  async function retryGenres() {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    setPending("genres");
    setAnnouncement("Loading genres…");
    try {
      const genres = await readCatalog<MovieGenre[] | null>("genres", "/", request.signal);
      if (active.current !== request) return;
      if (genres) {
        commit({ ...range, genres });
        setAnnouncement("Genres available.");
      } else {
        setAnnouncement("Genres are still unavailable.");
      }
    } catch {
      if (active.current === request) setAnnouncement("Genres are still unavailable.");
    } finally {
      if (active.current === request) {
        active.current = null;
        setPending(null);
      }
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadRange(catalogSearchHref(queryInput), "push");
  }

  const reset = () => void loadRange(catalogHref(defaultBrowse()), "push");

  return (
    <>
      <form action="/" className="search-form" role="search" onSubmit={submitSearch}>
        <label htmlFor="search-movies" className="sr-only">Movie title</label>
        <div className="search-input">
          <Search size={19} aria-hidden="true" />
          <input id="search-movies" className="input" type="search" name="q" value={queryInput}
            placeholder="Search by title" onChange={event => setQueryInput(event.target.value)} />
        </div>
        <button className="button" type="submit">Search</button>
      </form>

      <section className="catalog" aria-labelledby="catalog-heading">
        <div className="section-heading">
          <h2 id="catalog-heading">
            {search ? `Search results for “${search.query}”` : browse ? "Browse movies" : "Catalog"}
          </h2>
          <div className="catalog-actions">
            {search && (
              <button type="button" className="button button-quiet" onClick={reset}>Back to Browse</button>
            )}
            <button type="button" className="button button-quiet" onClick={reset}>Reset filters</button>
          </div>
        </div>

        {browse && (
          <div className="catalog-filters">
            <label className="catalog-field">
              Genre
              <select className="input" value={browse.genre ?? ""} disabled={!range.genres || pending === "range"}
                onChange={event => {
                  const genre = event.target.value ? Number(event.target.value) : null;
                  void loadRange(catalogHref({ ...browse, genre, page: 1 }), "push");
                }}>
                <option value="">All genres</option>
                {range.genres?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="catalog-field">
              Sort
              <select className="input" value={browse.sort} disabled={pending === "range"}
                onChange={event => {
                  const sort = catalogSort(event.target.value);
                  if (sort) void loadRange(catalogHref({ ...browse, sort, page: 1 }), "push");
                }}>
                {Object.entries(catalogSorts).map(([sort, label]) => <option key={sort} value={sort}>{label}</option>)}
              </select>
            </label>
            {!range.genres && (
              <div className="catalog-genre-feedback">
                <p role="status">Genres unavailable. You can still browse all genres.</p>
                <button type="button" className="button button-quiet" onClick={retryGenres}
                  aria-disabled={pending !== null}>Retry genres</button>
              </div>
            )}
          </div>
        )}

        {showResults && browse && (
          <p className="catalog-applied">
            {genreName} · {catalogSorts[browse.sort]}
            {browse.sort === "rating" && ` · At least ${MIN_RATING_VOTES} TMDB votes`}
            {browse.sort === "newest" && " · Released through today (UTC)"}
          </p>
        )}
        {showResults && range.notices.length > 0 && (
          <div className="catalog-notices" role="status">{range.notices.map(notice => <p key={notice}>{notice}</p>)}</div>
        )}
        <p className="sr-only" role="status">{announcement}</p>

        {pending === "range" && <LoadingState label="Loading movies…" />}
        {navigationFailure && pending !== "range" && (
          <div className="page-state">
            <h3 role="alert">Movies couldn’t load</h3>
            <button type="button" className="button button-quiet"
              onClick={() => void loadRange(navigationFailure.href, navigationFailure.change)}>Try again</button>
          </div>
        )}

        {showResults && (
          <div aria-busy={pending === "page"}>
            {range.failedPage === 1 ? !navigationFailure && (
              <div className="page-state">
                <h3 role="alert">Movies couldn’t load</h3>
                <p>Try fetching movies from TMDB again.</p>
                <button type="button" className="button button-quiet"
                  onClick={() => void loadRange(catalogHref(state), "replace")}>Try again</button>
              </div>
            ) : range.movies.length === 0 ? (
              state.mode === "search"
                ? <EmptyState title="No matching movies" description="Check the title or try a different search." />
                : <EmptyState title="No movies to show" description="Try a different genre, sort, or title." />
            ) : (
              <ul className="movie-grid">
                {range.movies.map(movie => (
                  <li key={movie.id}>
                    <Link href={`/movies/${movie.id}`} className="movie-card" prefetch={false}>
                      <MoviePoster path={movie.posterPath} title={movie.title} />
                      <span className="movie-card-info">
                        <strong>{movie.title}</strong>
                        <span>{movie.year ?? "Year unavailable"}</span>
                        <span className="movie-card-rating">
                          {movie.rating === null ? "TMDB Not rated" : `TMDB ${movie.rating.toFixed(1)}/10`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {showResults && range.movies.length > 0 && (
          <div className="catalog-pagination">
            {range.failedPage && range.failedPage > 1 && (
              <p className="form-error" role="alert">Couldn’t load more movies. Your results are still here.</p>
            )}
            <button type="button" className="button button-quiet"
              aria-disabled={pending === "page" || range.terminal || capReached}
              onClick={loadMore}>
              {pending === "page" ? "Loading more…" : range.failedPage ? "Retry" : "Load more"}
            </button>
            {range.terminal && <p role="status">No more results.</p>}
            {capReached && !range.terminal && (
              <p role="status">Showing the first {MAX_CATALOG_PAGE} pages. Refine your search or Browse settings.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
