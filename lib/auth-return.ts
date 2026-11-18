import { parseMovieId } from "./movies";

export const watchlistPath = "/watchlist";

export function safeReturnPath(target: unknown): string {
  if (typeof target !== "string" || /[^\x21-\x7e]|[%?#\\]/.test(target)) return watchlistPath;
  if (target === watchlistPath) return watchlistPath;

  const movie = /^\/movies\/([^/]+)$/.exec(target);
  if (movie && parseMovieId(movie[1]) !== null) return target;

  // P-03 reserves this path shape. Its destination and access checks are implemented in M2.
  if (/^\/sessions\/[A-Za-z0-9_-]{1,128}$/.test(target)) return target;
  return watchlistPath;
}

export function signInPath(target: string): string {
  return `/auth/login?next=${encodeURIComponent(safeReturnPath(target))}`;
}
