import "server-only";
import type { readAuth } from "./auth";

export type WatchlistItem = {
  tmdb_movie_id: number;
  title: string;
  poster_path: string | null;
  release_year: number | null;
};

type Owner = Extract<Awaited<ReturnType<typeof readAuth>>, { kind: "signed-in" }>;

export async function readWatchlist(owner: Owner): Promise<WatchlistItem[] | null> {
  try {
    const { data, error } = await owner.supabase
      .from("watchlist_items")
      .select("tmdb_movie_id,title,poster_path,release_year")
      .eq("owner_id", owner.ownerId)
      .order("saved_at", { ascending: false })
      .order("tmdb_movie_id", { ascending: false })
      .returns<WatchlistItem[]>();
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function readSavedMovie(owner: Owner, id: number): Promise<boolean | null> {
  try {
    const { data, error } = await owner.supabase
      .from("watchlist_items")
      .select("tmdb_movie_id")
      .eq("owner_id", owner.ownerId)
      .eq("tmdb_movie_id", id)
      .maybeSingle();
    return error ? null : data !== null;
  } catch {
    return null;
  }
}
