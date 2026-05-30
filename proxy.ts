import type { NextRequest } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Forward the current pathname to server components via a request header
  // so layouts can implement path-aware logic. The /app paywall in
  // app/app/layout.tsx needs to know whether the request is for a settings
  // route (which it allows even on the free plan) versus any other /app
  // route (which it gates behind a paid subscription).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = await updateSupabaseSession(request, requestHeaders);
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  // Match everything except static files and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
