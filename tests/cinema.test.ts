import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCinemaChoices, parseSessionId, toSessionView } from "../lib/cinema";

test("shortlists require two to five distinct valid IDs", () => {
  assert.deepEqual(parseCinemaChoices(["3", "1"], "shortlist"), [3, 1]);
  assert.deepEqual(parseCinemaChoices(["5", "4", "3", "2", "1"], "shortlist"), [5, 4, 3, 2, 1]);
  for (const invalid of [["1"], ["2", "2"], ["3", "0"], ["3", "02"], ["3", "2147483648"], ["1", "2", "3", "4", "5", "6"]]) {
    assert.equal(parseCinemaChoices(invalid, "shortlist"), null);
  }
});

test("vote input preserves intentional empty votes and normalizes a repeated selection", () => {
  assert.deepEqual(parseCinemaChoices([], "vote"), []);
  assert.deepEqual(parseCinemaChoices(["31", "2"], "vote"), parseCinemaChoices(["2", "31"], "vote"));
  assert.equal(parseCinemaChoices(["3", "3"], "vote"), null);
  assert.equal(parseCinemaChoices(["3", null], "vote"), null);
});

test("only canonical UUID shapes reach the session destination", () => {
  const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  assert.equal(parseSessionId(id.toUpperCase()), id);
  for (const invalid of [id + "\n", id.replaceAll("-", ""), id + "/extra", "%61" + id.slice(1)]) {
    assert.equal(parseSessionId(invalid), null);
  }
});

const a = { tmdb_movie_id: 10, title: "First", poster_path: null, release_year: 2001 };
const b = { tmdb_movie_id: 3, title: "Second", poster_path: null, release_year: 1987 };
const c = { tmdb_movie_id: 20, title: "Third", poster_path: null, release_year: 1994 };

// Reference rule for test fixtures. Production computes this in the database,
// where neither ballot has to cross the authorization boundary.
function expectedResult(shortlist: number[], first: number[] | null, second: number[] | null) {
  if (first === null || second === null) return { kind: "waiting" };
  const matches = shortlist.filter((id) => first.includes(id) && second.includes(id));
  return matches.length ? { kind: "matched", matches } : { kind: "no-match" };
}

test("the voting rule distinguishes no persisted ballot from an explicit empty vote", () => {
  assert.deepEqual(expectedResult([10, 3], null, null), { kind: "waiting" });
  assert.deepEqual(expectedResult([10, 3], [], null), { kind: "waiting" });
  assert.deepEqual(expectedResult([10, 3], [], [10]), { kind: "no-match" });
});

test("only the intersection is final, in shortlist order", () => {
  const shortlist = [a, b, c];
  const ids = shortlist.map((movie) => movie.tmdb_movie_id);
  assert.deepEqual(expectedResult(ids, [3, 10], [20, 3, 10]), { kind: "matched", matches: [10, 3] });
  assert.deepEqual(expectedResult(ids, [3, 10], [10, 3]), { kind: "matched", matches: [10, 3] });
  assert.deepEqual(expectedResult(ids, [3], [20]), { kind: "no-match" });
});

test("an unsubmitted viewer can vote even if the partner already submitted", () => {
  for (const partnerSubmitted of [false, true]) {
    assert.deepEqual(toSessionView({ isHost: false, ownSubmitted: false, partnerSubmitted, movies: [a, b] }),
      { kind: "voting", isHost: false, partnerSubmitted, movies: [a, b] });
  }
});

test("an empty ballot can wait and both submissions can finish with no matches", () => {
  assert.deepEqual(toSessionView({ isHost: true, ownSubmitted: true, partnerSubmitted: false, movies: [a, b] }),
    { kind: "waiting", isHost: true, partnerSubmitted: false, movies: [a, b] });
  assert.deepEqual(toSessionView({ isHost: true, ownSubmitted: true, partnerSubmitted: true, movies: [] }),
    { kind: "no-match", isHost: true, movies: [] });
});

test("completed results preserve database shortlist order and omit stray fields from the client payload", () => {
  const response = {
    isHost: false, ownSubmitted: true, partnerSubmitted: true, movies: [{ ...a, movie_ids: [10, 42] }, b],
    partnerBallot: [3, 10, 42],
  };
  assert.deepEqual(toSessionView(response), { kind: "matched", isHost: false, movies: [a, b] });
  assert.equal(toSessionView({ ...response, movies: [null] }), null);
});
