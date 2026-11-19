import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SignOutForm } from "@/components/account-forms";
import { EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import { WatchlistCinema } from "@/components/watchlist-cinema";
import { readAuth } from "@/lib/auth";
import { signInPath, watchlistPath } from "@/lib/auth-return";
import { readOwnCinemaUsername } from "@/lib/cinema-server";
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
  const [items, ownUsername] = await Promise.all([readWatchlist(owner), readOwnCinemaUsername(owner)]);
  if (items === null) {
    return <ErrorState title="Couldn’t load your Watchlist" description="Try fetching your saved movies again." />;
  }
  if (!items.length) {
    return (
      <div className="cinema-section">
        <p>Your cinema username: <strong>{ownUsername ?? "Unavailable"}</strong></p>
        <EmptyState title="Your Watchlist is empty" description="Save at least 2 movies to start Cinema for Two."
          link={{ href: "/", label: "Browse movies" }} />
      </div>
    );
  }

  return <WatchlistCinema key={owner.ownerId} items={items} ownUsername={ownUsername} />;
}
