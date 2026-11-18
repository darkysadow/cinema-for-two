import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { signInPath } from "../auth-return";

export async function updateSession(request: NextRequest) {
  // Pages and actions enforce access independently of the cookie refresh proxy.
  if (!hasEnvVars) {
    return NextResponse.next({ request });
  }

  const pendingCookies: Parameters<SetAllCookies>[0] = [];
  const authHeaders = new Headers();
  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          pendingCookies.push(...cookiesToSet);
          // Supabase supplies these only on the first auth cookie write.
          for (const [name, value] of Object.entries(headers)) authHeaders.set(name, value);
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  let claims;
  let needsSignIn = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    claims = data?.claims;
    needsSignIn = !error || error.name === "AuthSessionMissingError";
  } catch {
    // Public pages remain available during an Auth outage.
  }
  const redirectToSignIn = request.method === "GET" &&
    request.nextUrl.pathname === "/watchlist" && !claims && needsSignIn;
  const response = redirectToSignIn
    ? NextResponse.redirect(new URL(signInPath("/watchlist"), request.url))
    : NextResponse.next({ request });
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  for (const [name, value] of authHeaders) response.headers.set(name, value);
  return response;
}
