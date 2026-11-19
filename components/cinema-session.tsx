"use client";

import { Link as LinkIcon, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { submitCinemaVote } from "@/app/sessions/[sessionId]/actions";
import { sessionPath, type SessionView } from "@/lib/cinema";
import type { WatchlistItem } from "@/lib/watchlist";
import { MoviePoster } from "./movie-poster";
import { EmptyState } from "./page-state";

export function CinemaSession({ id, session }: { id: string; session: SessionView | null }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [draft, setDraft] = useState<Set<number>>(() => new Set());
  const [state, submit, submitting] = useActionState(submitCinemaVote.bind(null, id), { error: null });
  const pending = refreshing || submitting;

  function selectMovie(movieId: number, checked: boolean) {
    setDraft((previous) => {
      const next = new Set(previous);
      if (checked) next.add(movieId);
      else next.delete(movieId);
      return next;
    });
  }

  const refresh = (
    <button className="button button-quiet" type="button" disabled={pending}
      onClick={() => startRefresh(() => router.refresh())}>
      <RotateCcw className={refreshing ? "spinner" : undefined} size={16} aria-hidden="true" />
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );

  if (!session) {
    return (
      <div className="page-state" aria-busy={refreshing}>
        <h2>Couldn’t load this session</h2>
        <p>Refresh to try again.</p>
        {refresh}
      </div>
    );
  }

  return (
    <div className="cinema-section">
      {session.isHost && <ShareSession id={id} />}
      {session.kind === "voting" && (
        <form className="cinema-section" action={submit} aria-busy={submitting}>
          <input type="hidden" name="confirmVote" value="yes" />
          <fieldset className="cinema-section">
            <legend>Which movies would you watch?</legend>
            <p className="cinema-muted" role="status">{session.partnerSubmitted ? "Your partner has submitted." : "Your partner hasn’t submitted yet."}</p>
            <ul className="watchlist">
              {session.movies.map((movie) => (
                <li className="saved-movie" key={movie.tmdb_movie_id}>
                  <div className="cinema-choice">
                    <label className="cinema-pick">
                      <input type="checkbox" name="choiceId" value={movie.tmdb_movie_id}
                        checked={draft.has(movie.tmdb_movie_id)} disabled={pending}
                        onChange={(event) => selectMovie(movie.tmdb_movie_id, event.target.checked)} />
                      <span className="sr-only">Choose {movie.title}</span>
                    </label>
                    <SessionMovie movie={movie} />
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>
          <p className="cinema-muted">Your vote is final after you submit.</p>
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          <div className="cinema-buttons">
            <button className="button" type="submit" disabled={pending}>
              {submitting ? "Submitting…" : draft.size ? "Submit vote" : "Submit with no selections"}
            </button>
            {refresh}
          </div>
        </form>
      )}
      {session.kind === "waiting" && (
        <>
          <div className="page-state" aria-busy={refreshing}>
            <h2 role="status">Waiting for your partner</h2>
            <p>Your vote is in. Refresh after your partner submits.</p>
            {refresh}
          </div>
          <MovieList movies={session.movies} />
        </>
      )}
      {session.kind === "matched" && (
        <>
          <h2 className="cinema-heading" role="status">Your matches</h2>
          <MovieList movies={session.movies} />
        </>
      )}
      {session.kind === "no-match" && (
        <EmptyState title="No matches" description="You both voted, but didn’t choose any of the same movies." />
      )}
    </div>
  );
}

function MovieList({ movies }: { movies: WatchlistItem[] }) {
  return (
    <ul className="watchlist">
      {movies.map((movie) => (
        <li className="saved-movie" key={movie.tmdb_movie_id}>
          <SessionMovie movie={movie} />
        </li>
      ))}
    </ul>
  );
}

function SessionMovie({ movie }: { movie: WatchlistItem }) {
  return (
    <div className="cinema-movie">
      <MoviePoster path={movie.poster_path} title={movie.title} />
      <span className="movie-card-info">
        <strong>{movie.title}</strong>
        <span>{movie.release_year ?? "Year unavailable"}</span>
      </span>
    </div>
  );
}

function ShareSession({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  async function copyLink() {
    const url = new URL(sessionPath(id), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFallback(null);
    } catch {
      setCopied(false);
      setFallback(url);
    }
  }

  return (
    <div className="page-state">
      <p>Send this session link to the partner you invited.</p>
      <button className="button button-quiet" type="button" onClick={copyLink}>
        <LinkIcon size={16} aria-hidden="true" /> Copy session link
      </button>
      {copied && <p role="status">Link copied.</p>}
      {fallback && (
        <label className="cinema-field">
          Copy this link
          <input className="input" readOnly value={fallback} onFocus={(event) => event.target.select()} />
        </label>
      )}
    </div>
  );
}
