import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMovie, parseMovieId, posterUrl } from "../lib/movies";

test("missing or malformed optional movie fields get explicit nulls", () => {
  assert.deepEqual(normalizeMovie({
    id: 42, title: "  ", poster_path: "https://untrusted.example/poster.jpg",
    release_date: "2026-02-31", overview: [], vote_average: null,
  }), {
    id: 42, title: "Untitled movie", posterPath: null, year: null, overview: null, rating: null,
  });
  assert.equal(normalizeMovie({ id: 42 })?.rating, null);
  assert.equal(normalizeMovie({ id: 42, vote_average: "0" })?.rating, null);
  assert.equal(normalizeMovie({ id: 42, vote_average: Infinity })?.rating, null);
  assert.equal(normalizeMovie({ id: 42, vote_average: 10.1 })?.rating, null);
});

test("valid fields are normalized and a real zero stays zero", () => {
  assert.deepEqual(normalizeMovie({
    id: 42, title: " Movie ", poster_path: "/poster_42.jpg",
    release_date: "2024-02-29", overview: " Overview ", vote_average: 0,
  }), {
    id: 42, title: "Movie", posterPath: "/poster_42.jpg", year: 2024, overview: "Overview", rating: 0,
  });
});

test("movie IDs are positive canonical integers and poster paths stay on the image CDN", () => {
  for (const id of ["", "0", "0042", "-1", "42x", "4.2", "2147483648", "42\n"]) {
    assert.equal(parseMovieId(id), null, id);
  }
  assert.equal(parseMovieId("2147483647"), 2147483647);
  assert.equal(normalizeMovie({ id: "42" }), null);
  assert.equal(posterUrl("/poster.jpg", "w342"), "https://image.tmdb.org/t/p/w342/poster.jpg");
  for (const path of [null, "//external/poster.jpg", "/../poster.jpg", "/poster.jpg?x=1"]) {
    assert.equal(posterUrl(path, "w342"), null);
  }
});
