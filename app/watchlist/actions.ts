"use server";

import { refresh } from "next/cache";
import { readAuth } from "@/lib/auth";
import { parseMovieId } from "@/lib/movies";
import { movieDetails } from "@/lib/tmdb";
import { readSavedMovie } from "@/lib/watchlist";

export type WatchlistActionState = { error: string | null };

export async function updateWatchlist(
  _previous: WatchlistActionState,
  form: FormData,
): Promise<WatchlistActionState> {
  const id = parseMovieId(form.get("movieId"));
  const intent = form.get("intent");
  if (id === null || (intent !== "save" && intent !== "remove")) {
    return { error: "This Watchlist action is invalid." };
  }

  const owner = await readAuth();
  if (owner.kind === "signed-out") return { error: "Sign in again to change your Watchlist." };
  if (owner.kind !== "signed-in") return { error: "Couldn’t verify your sign-in. Try again." };

  try {
    const table = owner.supabase.from("watchlist_items");
    if (intent === "save") {
      const saved = await readSavedMovie(owner, id);
      if (saved === true) {
        refresh();
        return { error: null };
      }
      if (saved === null) return { error: "Couldn’t check your Watchlist. Try again." };

      const result = await movieDetails(id);
      if (result.kind === "not-found") return { error: "This movie is no longer available to save." };
      if (result.kind !== "ok") return { error: "Couldn’t load the movie to save it. Try again." };
      const movie = result.value;
      const { error } = await table.upsert(
        {
          owner_id: owner.ownerId,
          tmdb_movie_id: movie.id,
          title: movie.title,
          poster_path: movie.posterPath,
          release_year: movie.year,
        },
        { onConflict: "owner_id,tmdb_movie_id", ignoreDuplicates: true },
      );
      if (error) return { error: "Couldn’t save this movie. Try again." };
    } else {
      const { error } = await table
        .delete()
        .eq("owner_id", owner.ownerId)
        .eq("tmdb_movie_id", id);
      if (error) return { error: "Couldn’t remove this movie. Try again." };
    }
  } catch {
    return { error: "Couldn’t update your Watchlist. Try again." };
  }

  refresh();
  return { error: null };
}
