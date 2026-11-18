import "server-only";
import { normalizeMovie, type Movie } from "./movies";

type Result<T> = { kind: "ok"; value: T } | { kind: "unavailable" };
type MovieResult = Result<Movie> | { kind: "not-found" };

async function readTmdb(path: string): Promise<Result<unknown> | { kind: "not-found" }> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) return { kind: "unavailable" };

  try {
    const response = await fetch(`https://api.themoviedb.org/3${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) return { kind: "not-found" };
    if (!response.ok) return { kind: "unavailable" };
    return { kind: "ok", value: await response.json() };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function catalogMovies(query: string): Promise<Result<Movie[]>> {
  const path = query
    ? `/search/movie?${new URLSearchParams({ query, include_adult: "false", page: "1" })}`
    : "/movie/popular?page=1";
  const result = await readTmdb(path);
  if (result.kind !== "ok") return { kind: "unavailable" };
  const body = result.value;
  if (typeof body !== "object" || body === null || !("results" in body) || !Array.isArray(body.results)) {
    return { kind: "unavailable" };
  }
  const movies = new Map<number, Movie>();
  for (const row of body.results) {
    const movie = normalizeMovie(row);
    if (movie && !movies.has(movie.id)) movies.set(movie.id, movie);
  }
  if (body.results.length && !movies.size) return { kind: "unavailable" };
  return { kind: "ok", value: [...movies.values()] };
}

export async function movieDetails(id: number): Promise<MovieResult> {
  const result = await readTmdb(`/movie/${id}`);
  if (result.kind !== "ok") return result;
  const movie = normalizeMovie(result.value);
  if (!movie || movie.id !== id) return { kind: "unavailable" };
  return { kind: "ok", value: movie };
}
