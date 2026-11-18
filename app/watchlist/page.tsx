import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SignOutForm } from "@/components/account-forms";
import { MoviePoster } from "@/components/movie-poster";
import { EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import { WatchlistForm } from "@/components/watchlist-form";
import { readAuth } from "@/lib/auth";
import { signInPath, watchlistPath } from "@/lib/auth-return";
import { readWatchlist } from "@/lib/watchlist";

export const metadata: Metadata = { title: "Watchlist" };

export default function Page() {
  return (
    <>
      <div className="page-intro">
        <h1>Your Watchlist</h1>
        <p>Movies you’ve saved for later.</p>
      </div>
      <Suspense fallback={<LoadingState label="Loading Watchlist…" />}>
        <Watchlist />
      </Suspense>
    </>
  );
}

async function Watchlist() {
  await connection();
  const owner = await readAuth();
  if (owner.kind === "signed-out") redirect(signInPath(watchlistPath));
  if (owner.kind === "unavailable") {
    return <ErrorState title="Couldn’t verify your sign-in" description="Try loading your Watchlist again." />;
  }
  return (
    <>
      <div className="watchlist-controls"><SignOutForm /></div>
      <Suspense fallback={<LoadingState label="Loading saved movies…" />}>
        <SavedMovies owner={owner} />
      </Suspense>
    </>
  );
}

async function SavedMovies({ owner }: { owner: Extract<Awaited<ReturnType<typeof readAuth>>, { kind: "signed-in" }> }) {
  const items = await readWatchlist(owner);
  if (items === null) {
    return <ErrorState title="Couldn’t load your Watchlist" description="Try fetching your saved movies again." />;
  }
  if (!items.length) {
    return <EmptyState title="Your Watchlist is empty" description="Discover a movie and save it here for later."
      link={{ href: "/", label: "Browse movies" }} />;
  }

  return (
    <ul className="watchlist">
      {items.map((movie) => (
        <li className="saved-movie" key={movie.tmdb_movie_id}>
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
  );
}
