import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, Bookmark, Star } from "lucide-react";
import { MoviePoster } from "@/components/movie-poster";
import { ErrorState, LoadingState } from "@/components/page-state";
import { WatchlistForm } from "@/components/watchlist-form";
import { readAuth } from "@/lib/auth";
import { signInPath } from "@/lib/auth-return";
import { parseMovieId } from "@/lib/movies";
import { movieDetails } from "@/lib/tmdb";
import { readSavedMovie } from "@/lib/watchlist";

type DetailsProps = { params: Promise<{ movieId: string }> };

export default function Page({ params }: DetailsProps) {
  return (
    <>
      <Link href="/" className="back-link"><ArrowLeft size={17} aria-hidden="true" /> Catalog</Link>
      <Suspense fallback={<LoadingState label="Loading movie details…" />}>
        <Details params={params} />
      </Suspense>
    </>
  );
}

async function Details({ params }: DetailsProps) {
  const id = parseMovieId((await params).movieId);
  if (id === null) notFound();

  await connection();
  const result = await movieDetails(id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "unavailable") {
    return <ErrorState title="Movie details couldn’t load" description="Try fetching this movie from TMDB again." />;
  }

  const movie = result.value;
  return (
    <article className="movie-details">
      <div className="detail-poster"><MoviePoster path={movie.posterPath} title={movie.title}
        size="w500" prominent /></div>
      <div className="detail-info">
        <div className="page-intro">
          <h1>{movie.title}</h1>
          <p>{movie.year ?? "Year unavailable"}</p>
        </div>
        <div className="rating">
          <Star size={18} aria-hidden="true" />
          <span>TMDB rating</span>
          <strong>{movie.rating === null ? "Unavailable" : `${movie.rating.toFixed(1)}/10`}</strong>
        </div>
        <div className="overview">
          <h2>Overview</h2>
          <p>{movie.overview ?? "Overview unavailable."}</p>
        </div>
        <div className="save-panel">
          <Suspense fallback={<LoadingState label="Checking Watchlist…" />}>
            <SaveControl id={movie.id} title={movie.title} />
          </Suspense>
        </div>
      </div>
    </article>
  );
}

async function SaveControl({ id, title }: { id: number; title: string }) {
  const auth = await readAuth();
  if (auth.kind === "signed-out") {
    return (
      <Link className="button" href={signInPath(`/movies/${id}`)}>
        <Bookmark size={17} aria-hidden="true" />
        Sign in to save
      </Link>
    );
  }
  const saved = auth.kind === "signed-in" ? await readSavedMovie(auth, id) : null;
  if (saved === null) {
    return <ErrorState title="Couldn’t check your Watchlist" description="Try loading the saved status again." />;
  }
  return (
    <>
      {saved && <p className="saved-status" role="status">Saved to your Watchlist</p>}
      <WatchlistForm key={`${id}-${saved}`} movieId={id} title={title} saved={saved} />
    </>
  );
}
