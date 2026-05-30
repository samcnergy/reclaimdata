import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresh the Supabase session cookies on every request. Called from the
 * top-level middleware so server components always see the latest tokens.
 *
 * Resilient to missing env: the proxy must never 500 the marketing site.
 * If Supabase env vars are absent we skip the refresh entirely and let
 * downstream auth checks (requireUser) gate /app/* routes the same way
 * they would for a logged-out user.
 */
export async function updateSupabaseSession(
  request: NextRequest,
  requestHeaders?: Headers,
) {
  // When the caller passes an augmented headers set (e.g. proxy.ts adds
  // x-pathname so server components can read the current path), forward
  // those into the rewritten request rather than the original ones.
  const headers = requestHeaders ?? request.headers;
  let response = NextResponse.next({ request: { headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return response;
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    await supabase.auth.getUser();
  } catch (err) {
    // Don't 500 the request just because session refresh hit an error.
    // requireUser() in /app/* will redirect to /login as a logged-out
    // user, which is the same behaviour as no cookies present.
    console.error(
      "[supabase.middleware] session refresh failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return response;
}
