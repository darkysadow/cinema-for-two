import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { MoviePoster } from "@/components/movie-poster";
import { EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import { catalogMovies } from "@/lib/tmdb";

type CatalogProps = { searchParams: Promise<{ q?: string | string[] }> };

export default function Page({ searchParams }: CatalogProps) {
  return (
    <>
      <div className="page-intro">
        <h1>Discover movies</h1>
        <p>Search for a title or see what’s popular.</p>
      </div>
      <Suspense fallback={<LoadingState label="Loading catalog…" />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Catalog({ searchParams }: CatalogProps) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  return (
    <>
      <form action="/" className="search-form" role="search" key={query}>
        <label htmlFor="search-movies" className="sr-only">Movie title</label>
        <div className="search-input">
          <Search size={19} aria-hidden="true" />
          <input id="search-movies" className="input" type="search" name="q"
            placeholder="Search by title" defaultValue={query} />
        </div>
        <button className="button" type="submit">Search</button>
      </form>
      <section className="catalog" aria-labelledby="catalog-heading">
        <div className="section-heading">
          <h2 id="catalog-heading">{query ? `Results for “${query}”` : "Popular movies"}</h2>
          {query && <Link href="/" className="text-link">Clear search</Link>}
        </div>
        <Suspense key={query} fallback={<LoadingState label="Loading movies…" />}>
          <Results query={query} />
        </Suspense>
      </section>
    </>
  );
}

async function Results({ query }: { query: string }) {
  await connection();
  const result = await catalogMovies(query);
  if (result.kind !== "ok") {
    return <ErrorState title="Movies couldn’t load" description="Try fetching movies from TMDB again." />;
  }
  if (!result.value.length) {
    return query
      ? <EmptyState title="No matching movies" description="Check the title or try a different search." />
      : <EmptyState title="No popular movies right now" description="TMDB returned an empty popular list." />;
  }

  return (
    <ul className="movie-grid">
      {result.value.map((movie) => (
        <li key={movie.id}>
          <Link href={`/movies/${movie.id}`} className="movie-card" prefetch={false}>
            <MoviePoster path={movie.posterPath} title={movie.title} />
            <span className="movie-card-info">
              <strong>{movie.title}</strong>
              <span>{movie.year ?? "Year unavailable"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
