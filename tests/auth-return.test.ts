import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath, signInPath } from "../lib/auth-return";

const sessionPath = "/sessions/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("only approved local destinations can survive sign-in", () => {
  for (const path of ["/watchlist", "/movies/42", sessionPath]) {
    assert.equal(safeReturnPath(path), path);
    assert.equal(new URL(signInPath(path), "http://localhost").searchParams.get("next"), path);
  }
});

test("unsafe, malformed, and unapproved redirect targets fall back to Watchlist", () => {
  for (const target of [
    undefined, null, ["/movies/42"], "https://external.example", "//external.example",
    "/\\external.example", "/%2fexternal.example", "%252f%252fexternal.example",
    "/movies/42?next=//external.example", "/movies/42#fragment", "/movies/42\n",
    "/movies/042", "/movies/2147483648", "/movies/42/..", "/sessions/.", "/sessions/id%2fother",
    "/sessions/opaque_id-123", `${sessionPath}/extra`, `${sessionPath}?next=/watchlist`,
    "/auth/login", "/", "/protected",
  ]) {
    assert.equal(safeReturnPath(target), "/watchlist", String(target));
  }
});
