"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { createCinemaSession } from "@/app/watchlist/cinema-actions";
import { maxShortlist, minShortlist } from "@/lib/cinema";
import { createCinemaWithFeedback } from "@/lib/cinema-create-feedback";
import type { WatchlistItem } from "@/lib/watchlist";
import { MoviePoster } from "./movie-poster";
import { WatchlistForm } from "./watchlist-form";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function WatchlistCinema({ items, ownUsername }: { items: WatchlistItem[]; ownUsername: string | null }) {
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [state, action, pending] = useActionState(
    createCinemaWithFeedback.bind(null, createCinemaSession), { error: null },
  );
  const [draft, setDraft] = useState<Set<number>>(() => new Set());
  const [username, setUsername] = useState("");
  const canCreate = items.length >= minShortlist;
  const selectedMovies = items.filter((movie) => draft.has(movie.tmdb_movie_id));
  const selectedCount = selectedMovies.length;
  const usernameLabel = <p>Your cinema username: <strong>{ownUsername ?? "Unavailable"}</strong></p>;

  function selectMovie(id: number, checked: boolean) {
    setDraft((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <section className="cinema-section" aria-label="Cinema for Two shortlist">
      <div className="cinema-intro">
        <h2>Start Cinema for Two</h2>
        <p>{canCreate ? "Choose 2 to 5 saved movies, then invite someone by username." : "Save at least 2 movies to start a session."}</p>
        {!canCreate && usernameLabel}
      </div>
      <ul className="watchlist">
        {items.map((movie) => (
          <li className="saved-movie" key={movie.tmdb_movie_id}>
            {canCreate && (
              <label className="cinema-pick">
                <input type="checkbox"
                  checked={draft.has(movie.tmdb_movie_id)} onChange={(event) => selectMovie(movie.tmdb_movie_id, event.target.checked)}
                  disabled={!ready || pending || (selectedCount >= maxShortlist && !draft.has(movie.tmdb_movie_id))} />
                <span className="sr-only">Shortlist {movie.title}</span>
              </label>
            )}
            <Link href={`/movies/${movie.tmdb_movie_id}`} className="saved-movie-link" prefetch={false}>
              <MoviePoster path={movie.poster_path} title={movie.title} />
              <span className="movie-card-info">
                <strong>{movie.title}</strong>
                <span>{movie.release_year ?? "Year unavailable"}</span>
              </span>
            </Link>
            <WatchlistForm movieId={movie.tmdb_movie_id} title={movie.title} saved compact />
          </li>
        ))}
      </ul>
      {canCreate && (
        <form className="cinema-form page-state" action={action} aria-busy={pending}>
          {/* The action's native form reset must not reset the visible selections. */}
          {selectedMovies.map(({ tmdb_movie_id }) => (
            <input key={tmdb_movie_id} type="hidden" name="candidateId" value={tmdb_movie_id} />
          ))}
          <p role="status">{ready ? `${selectedCount} of ${maxShortlist} selected` : "Loading session controls…"}</p>
          {usernameLabel}
          {!ready && <p className="cinema-muted">If these controls stay unavailable, reload the page and check that its scripts loaded.</p>}
          <label className="cinema-field">
            Partner’s username
            <input className="input" name="username" type="text" required autoComplete="off" autoCapitalize="none" spellCheck={false}
              value={username} disabled={!ready || pending} onChange={(event) => setUsername(event.target.value)} />
          </label>
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          {pending && <p className="cinema-muted" role="status">Waiting for the server. If the connection fails, <a href="/watchlist">reload Watchlist</a> before trying again.</p>}
          <button className="button" type="submit" disabled={!ready || pending || selectedCount < minShortlist}>
            {pending ? "Creating session…" : "Create session"}
          </button>
        </form>
      )}
    </section>
  );
}
