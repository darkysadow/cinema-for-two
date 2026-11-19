import { Suspense } from "react";
import { MovieCatalog } from "@/components/movie-catalog";
import { LoadingState } from "@/components/page-state";
import { catalogParamsFromRecord } from "@/lib/catalog";
import { catalogReader } from "@/lib/tmdb";

type CatalogProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function Page({ searchParams }: CatalogProps) {
  return (
    <>
      <div className="page-intro">
        <h1>Discover movies</h1>
        <p>Browse by genre or search for a title.</p>
      </div>
      <Suspense fallback={<LoadingState label="Loading catalog…" />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Catalog({ searchParams }: CatalogProps) {
  const params = catalogParamsFromRecord(await searchParams);
  const initial = await catalogReader.readRange(params);
  const requestedSearch = params.toString();
  return <MovieCatalog key={requestedSearch} initial={initial} requestedSearch={requestedSearch} />;
}
