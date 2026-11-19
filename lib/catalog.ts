import { parseMovieId, type Movie } from "./movies";

export const MAX_CATALOG_PAGE = 5;
export const MIN_RATING_VOTES = 100;

export const catalogSorts = {
  popular: "Popular",
  rating: "Top rated",
  newest: "Newest",
} as const;

export type CatalogSort = keyof typeof catalogSorts;
export type MovieGenre = { id: number; name: string };

export type CatalogState =
  | { mode: "browse"; genre: number | null; sort: CatalogSort; page: number }
  | { mode: "search"; query: string; page: number };

export type CatalogPage = {
  page: number;
  movies: Movie[];
  totalPages: number;
  totalResults: number;
  empty: boolean;
};

export type CatalogRange = {
  state: CatalogState;
  genres: MovieGenre[] | null;
  notices: string[];
  movies: Movie[];
  failedPage: number | null;
  terminal: boolean;
  cutoff: string | null;
};

export type CatalogPageRead = {
  state: CatalogState;
  page: CatalogPage | null;
  cutoff: string | null;
};

export function defaultBrowse(): CatalogState {
  return { mode: "browse", genre: null, sort: "popular", page: 1 };
}

export function catalogParamsFromRecord(record: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item);
    }
  }
  return params;
}

export function catalogTitle(params: URLSearchParams) {
  const raw = params.get("q");
  if (raw === null) return { kind: "absent" } as const;
  const query = raw.trim();
  if (!query) return { kind: "blank" } as const;
  // Reject oversized input before iterating code points. Each takes at most two code units.
  if (query.length > 400 || [...query].length > 200 || /[\u0000-\u001f\u007f]/u.test(query)) {
    return { kind: "invalid" } as const;
  }
  return { kind: "search", query } as const;
}

export function catalogSort(value: string | null): CatalogSort | null {
  switch (value) {
    case "popular":
    case "rating":
    case "newest":
      return value;
    default:
      return null;
  }
}

function requestedPage(raw: string | null) {
  if (!raw || !/^[1-9][0-9]*$(?![\s\S])/.test(raw)) return { page: 1, capped: false };
  // The limit is one digit. Longer canonical integers are above it regardless of magnitude.
  const capped = raw.length > 1 || Number(raw) > MAX_CATALOG_PAGE;
  return { page: capped ? MAX_CATALOG_PAGE : Number(raw), capped };
}

export function normalizeCatalogParams(params: URLSearchParams, genres: MovieGenre[] | null): {
  state: CatalogState;
  notices: string[];
} {
  const title = catalogTitle(params);
  const notices: string[] = [];
  if (title.kind === "blank" || title.kind === "invalid") {
    if (title.kind === "invalid") {
      notices.push("Enter a title of up to 200 characters without control characters.");
    }
    return { state: defaultBrowse(), notices };
  }

  const requested = requestedPage(params.get("page"));
  if (title.kind === "search") {
    if (requested.capped) notices.push("The requested page was limited to page 5.");
    return { state: { mode: "search", query: title.query, page: requested.page }, notices };
  }

  const rawGenre = params.get("genre");
  const rawSort = params.get("sort");
  const genreId = parseMovieId(rawGenre);
  const genre = genres?.some((candidate) => candidate.id === genreId) ? genreId : null;
  const sort = catalogSort(rawSort);
  if (rawGenre && genre === null) {
    notices.push(genreId !== null && genres === null
      ? "The requested genre couldn’t be applied. Showing all genres."
      : "That genre isn’t available. Showing all genres.");
  }
  if (rawSort && sort === null) notices.push("That sort isn’t available. Showing Popular.");
  const filtersReset = notices.length > 0;
  if (!filtersReset && requested.capped) notices.push("The requested page was limited to page 5.");

  return {
    state: { mode: "browse", genre, sort: sort ?? "popular", page: filtersReset ? 1 : requested.page },
    notices,
  };
}

export function catalogHref(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.mode === "search") {
    params.set("q", state.query);
  } else {
    if (state.genre !== null) params.set("genre", String(state.genre));
    params.set("sort", state.sort);
  }
  params.set("page", String(state.page));
  return `/?${params}`;
}

export function catalogSearchHref(query: string): string {
  return `/?${new URLSearchParams({ q: query })}`;
}

export function appendCatalogMovies(earlier: Movie[], later: Movie[]): Movie[] {
  const seen = new Set(earlier.map(({ id }) => id));
  return [...earlier, ...later.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}

export function isTerminalCatalogPage(page: CatalogPage): boolean {
  return page.empty || page.page >= page.totalPages;
}
