import { parseMovieId } from "./movies";
import { sessionIdFromPath, sessionPath } from "./cinema";

export const watchlistPath = "/watchlist";

export function safeReturnPath(target: unknown): string {
  if (typeof target !== "string" || /[^\x21-\x7e]|[%?#\\]/.test(target)) return watchlistPath;
  if (target === watchlistPath) return watchlistPath;

  const movie = /^\/movies\/([^/]+)$/.exec(target);
  if (movie && parseMovieId(movie[1]) !== null) return target;

  const sessionId = sessionIdFromPath(target);
  if (sessionId) return sessionPath(sessionId);
  return watchlistPath;
}

export function signInPath(target: string): string {
  return `/auth/login?next=${encodeURIComponent(safeReturnPath(target))}`;
}
