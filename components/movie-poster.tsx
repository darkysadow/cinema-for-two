"use client";

import { Film } from "lucide-react";
import { useCallback, useState } from "react";
import { posterUrl } from "@/lib/movies";

export function MoviePoster({
  path,
  title,
  size = "w342",
  prominent = false,
}: {
  path: string | null;
  title: string;
  size?: "w342" | "w500";
  prominent?: boolean;
}) {
  const src = posterUrl(path, size);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const checkCompletedImage = useCallback((image: HTMLImageElement | null) => {
    // A server-rendered image can fail before hydration attaches onError.
    if (image?.complete && image.naturalWidth === 0) setFailedSource(src);
  }, [src]);
  return (
    <div className="movie-poster">
      {src && failedSource !== src ? (
        /* eslint-disable-next-line @next/next/no-img-element -- TMDB's image CDN provides sized posters. */
        <img
          ref={checkCompletedImage}
          src={src}
          alt={prominent ? `Poster for ${title}` : ""}
          width={342}
          height={513}
          loading={prominent ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <div className="poster-fallback" aria-hidden="true">
          <Film size={28} />
          <span>No poster</span>
        </div>
      )}
    </div>
  );
}
