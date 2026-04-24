import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Fetches the authenticated user from the request cookies. Returns null
 * when there's no session instead of throwing.
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Route-guard helper for server components and route handlers. Redirects
 * to /login (optionally preserving the intended destination) if no user.
 */
export async function requireUser(options?: { redirectTo?: string }) {
  const user = await getAuthUser();
  if (!user) {
    const target = options?.redirectTo ?? "/app";
    redirect(`/login?next=${encodeURIComponent(target)}`);
  }
  return user;
}
