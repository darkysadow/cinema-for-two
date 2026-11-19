"use client";

import { useActionState } from "react";
import { Bookmark, BookmarkMinus, Trash2 } from "lucide-react";
import { updateWatchlist } from "@/app/watchlist/actions";

export function WatchlistForm({ movieId, title, saved, compact = false }: {
  movieId: number;
  title: string;
  saved: boolean;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(updateWatchlist, { error: null });
  const Icon = compact ? Trash2 : saved ? BookmarkMinus : Bookmark;
  const label = saved ? "Remove from Watchlist" : "Save to Watchlist";
  return (
    <form className="compact-form" action={action} aria-busy={pending}>
      <input type="hidden" name="movieId" value={movieId} />
      <input type="hidden" name="intent" value={saved ? "remove" : "save"} />
      <button type="submit" className={saved ? "button button-quiet" : "button"}
        disabled={pending} aria-label={compact && !pending ? `Remove ${title} from Watchlist` : undefined}>
        <Icon size={17} aria-hidden="true" />
        {pending ? (saved ? "Removing…" : "Saving…") : compact ? "Remove" : label}
      </button>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
  );
}
