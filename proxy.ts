import type { NextRequest } from "next/server";

import { applySecurityHeaders } from "@/lib/security/headers";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const response = await updateSupabaseSession(request);
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  // Match everything except static files and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
