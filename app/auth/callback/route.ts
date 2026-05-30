import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles Supabase Auth email confirmation + magic link callbacks.
 * Supabase sends the user here with a `code` query param; we exchange it
 * for a session cookie and then forward on to the intended destination.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";

  // Use the canonical public origin from env rather than request.url.
  // Behind Render's load balancer, request.url carries the internal address
  // (http://reclaimdata:10000/...) which would produce redirects to that
  // internal host. Compute the origin once and reuse for both the success
  // and the error paths.
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (() => {
      const u = new URL(request.url);
      return `${u.protocol}//${u.host}`;
    })();

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Translate the most common Supabase error into something a user can
      // actually act on. The raw message ("PKCE code verifier not found in
      // storage. ...") is technically accurate but reads like a stack trace.
      const friendly = /pkce code verifier not found/i.test(error.message)
        ? "Your confirmation link couldn't be verified. This usually happens when the email is opened in a different browser than the one you signed up in, or after cookies were cleared. Please request a new link from the same browser."
        : error.message;
      return NextResponse.redirect(
        `${appOrigin}/login?error=${encodeURIComponent(friendly)}`,
      );
    }
  }

  // Guard against open-redirect: `next` must be a relative path, not a
  // protocol-relative URL (//evil.com) or an absolute URL (https://evil.com).
  const safePath =
    next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  return NextResponse.redirect(`${appOrigin}${safePath}`);
}
