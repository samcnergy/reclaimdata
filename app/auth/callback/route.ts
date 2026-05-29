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

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
      );
    }
  }

  // Guard against open-redirect: `next` must be a relative path, not a
  // protocol-relative URL (//evil.com) or an absolute URL (https://evil.com).
  const safePath =
    next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  // Use the canonical public origin from env rather than request.url.
  // Behind Render's load balancer, request.url carries the internal address
  // (http://reclaimdata:10000/...) which would produce a redirect to that
  // internal host instead of the real public domain.
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (() => {
      const u = new URL(request.url);
      return `${u.protocol}//${u.host}`;
    })();

  return NextResponse.redirect(`${appOrigin}${safePath}`);
}
