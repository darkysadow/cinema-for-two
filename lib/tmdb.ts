import "server-only";
import { normalizeMovie, type Movie } from "./movies";
import { createCatalogReader } from "./catalog-tmdb";

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

export const catalogReader = createCatalogReader(async path => {
  const result = await readTmdb(path);
  return result.kind === "ok" ? result.value : null;
});

export async function movieDetails(id: number): Promise<MovieResult> {
  const result = await readTmdb(`/movie/${id}`);
  if (result.kind !== "ok") return result;
  const movie = normalizeMovie(result.value);
  if (!movie || movie.id !== id) return { kind: "unavailable" };
  return { kind: "ok", value: movie };
}
