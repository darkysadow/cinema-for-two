const posterPathPattern = /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$(?![\s\S])/i;

export type Movie = {
  id: number;
  title: string;
  posterPath: string | null;
  year: number | null;
  overview: string | null;
  rating: number | null;
};

export function parseMovieId(input: unknown): number | null {
  if (typeof input !== "string" || !/^[1-9][0-9]{0,9}$(?![\s\S])/.test(input)) return null;
  const id = Number(input);
  return id <= 2_147_483_647 ? id : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function releaseYear(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const year = Number(value.slice(0, 4));
  return year >= 1 ? year : null;
}

function normalizeRating(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10
    ? value
    : null;
}

export function posterUrl(path: string | null, size: "w342" | "w500"): string | null {
  return path && posterPathPattern.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function normalizeMovie(value: unknown): Movie | null {
  if (typeof value !== "object" || value === null || !("id" in value)) return null;
  if (typeof value.id !== "number") return null;
  const id = parseMovieId(String(value.id));
  if (id === null) return null;

  const row = value as Record<string, unknown>;
  return {
    id,
    title: textOrNull(row.title) ?? "Untitled movie",
    posterPath: typeof row.poster_path === "string" && posterPathPattern.test(row.poster_path)
      ? row.poster_path
      : null,
    year: releaseYear(row.release_date),
    overview: textOrNull(row.overview),
    rating: normalizeRating(row.vote_average),
  };
}
