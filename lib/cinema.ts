import { parseMovieId } from "./movies";
import type { WatchlistItem } from "./watchlist";

export const minShortlist = 2;
export const maxShortlist = 5;

export function parseSessionId(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$(?![\s\S])/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function sessionIdFromPath(path: string): string | null {
  return path.startsWith("/sessions/") ? parseSessionId(path.slice("/sessions/".length)) : null;
}

export function sessionPath(id: string): string {
  return `/sessions/${id}`;
}

export function parseCinemaChoices(values: readonly unknown[], purpose: "shortlist" | "vote"): number[] | null {
  if (values.length > maxShortlist || (purpose === "shortlist" && values.length < minShortlist)) return null;
  const ids = new Set<number>();
  for (const value of values) {
    const id = parseMovieId(value);
    if (id === null || ids.has(id)) return null;
    ids.add(id);
  }
  return purpose === "shortlist" ? [...ids] : [...ids].sort((a, b) => a - b);
}

export type SessionView =
  | { kind: "voting" | "waiting"; isHost: boolean; partnerSubmitted: boolean; movies: WatchlistItem[] }
  | { kind: "matched" | "no-match"; isHost: boolean; movies: WatchlistItem[] };

export function toSessionView(response: unknown): SessionView | null {
  if (typeof response !== "object" || response === null) return null;
  const { isHost, ownSubmitted, partnerSubmitted, movies: snapshots } = response as Record<string, unknown>;
  if (typeof isHost !== "boolean" || typeof ownSubmitted !== "boolean" ||
    typeof partnerSubmitted !== "boolean" || !Array.isArray(snapshots)) return null;

  const movies: WatchlistItem[] = [];
  for (const snapshot of snapshots) {
    const movie = readMovieSnapshot(snapshot);
    if (!movie) return null;
    movies.push(movie);
  }
  if (ownSubmitted && partnerSubmitted) {
    return { kind: movies.length ? "matched" : "no-match", isHost, movies };
  }
  return { kind: ownSubmitted ? "waiting" : "voting", isHost, partnerSubmitted, movies };
}

function readMovieSnapshot(value: unknown): WatchlistItem | null {
  if (typeof value !== "object" || value === null) return null;
  const { tmdb_movie_id, title, poster_path, release_year } = value as Record<string, unknown>;
  if (typeof tmdb_movie_id !== "number" || parseMovieId(String(tmdb_movie_id)) === null || typeof title !== "string" ||
    (poster_path !== null && typeof poster_path !== "string") ||
    (release_year !== null && typeof release_year !== "number")) return null;
  return { tmdb_movie_id, title, poster_path, release_year };
}
