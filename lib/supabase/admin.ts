import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS.
 * ONLY use in webhook handlers, cron jobs, and other trusted server contexts
 * where the tenant boundary is enforced by other means. Never expose to the browser.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
