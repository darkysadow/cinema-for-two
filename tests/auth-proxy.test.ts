import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { NextRequest, type NextResponse } from "next/server";

const authUrl = "https://auth-fixture.invalid";
const cookieName = "sb-auth-fixture-auth-token";
const user = { id: "proxy-test-user" };

async function proxy() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = authUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "proxy-test-key";
  return (await import("../lib/supabase/proxy")).updateSession;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function expiredRequest(path: string) {
  const session = { access_token: "expired", refresh_token: "old-refresh", expires_at: 1, user };
  return new NextRequest(`https://app-fixture.invalid${path}`, {
    headers: { cookie: `${cookieName}=base64-${encode(session)}` },
  });
}

function mockAuth(t: TestContext, refreshResult: object) {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(url.origin, authUrl);
    requests.push(url.pathname + url.search);
    if (url.pathname === "/auth/v1/token") return Response.json(refreshResult);
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    return new Response(null, { status: 404 });
  });
  return requests;
}

function assertAuthCacheHeaders(response: NextResponse) {
  assert.equal(response.headers.get("cache-control"), "private, no-cache, no-store, must-revalidate, max-age=0");
  assert.equal(response.headers.get("expires"), "0");
  assert.equal(response.headers.get("pragma"), "no-cache");
}

test("a refreshed auth cookie and Supabase cache headers reach the continuing response", async (t) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${encode({ alg: "HS256" })}.${encode({ sub: user.id, exp })}.c2ln`;
  const requests = mockAuth(t, {
    access_token: jwt, refresh_token: "new-refresh", expires_in: 3600,
    expires_at: exp, token_type: "bearer", user,
  });
  const updateSession = await proxy();
  const request = expiredRequest("/watchlist");
  const response = await updateSession(request);
  assert.deepEqual(requests, ["/auth/v1/token?grant_type=refresh_token", "/auth/v1/user"]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  const refreshed = response.cookies.get(cookieName);
  assert.ok(refreshed);
  assert.ok(refreshed.value.startsWith("base64-"));
  const stored = JSON.parse(Buffer.from(refreshed.value.slice(7), "base64url").toString());
  assert.equal(stored.refresh_token, "new-refresh");
  assert.equal(request.cookies.get(cookieName)?.value, refreshed.value);
  assert.ok(response.headers.get("x-middleware-request-cookie")?.includes(refreshed.value));
  assertAuthCacheHeaders(response);
});

test("a cleared auth cookie and Supabase cache headers reach the Watchlist redirect", async (t) => {
  // A refresh response without a session causes Supabase to clear the expired cookie.
  const requests = mockAuth(t, {});
  const updateSession = await proxy();
  const response = await updateSession(expiredRequest("/watchlist"));
  assert.deepEqual(requests, ["/auth/v1/token?grant_type=refresh_token"]);
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://app-fixture.invalid/auth/login?next=%2Fwatchlist");
  assert.equal(response.cookies.get(cookieName)?.value, "");
  assert.equal(response.cookies.get(cookieName)?.maxAge, 0);
  assertAuthCacheHeaders(response);
});

test("a signed-out session visit retains the UUID as its sign-in destination", async (t) => {
  mockAuth(t, {});
  const updateSession = await proxy();
  const path = "/sessions/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const response = await updateSession(expiredRequest(path + "?next=//external.example"));
  const location = new URL(response.headers.get("location")!);
  assert.equal(response.status, 307);
  assert.equal(location.pathname, "/auth/login");
  assert.equal(location.searchParams.get("next"), path);
  assertAuthCacheHeaders(response);
});
