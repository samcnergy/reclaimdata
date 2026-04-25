import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Ensures the signed-in user has at least one workspace.
 *
 * Race-safe: delegates to the `ensure_default_workspace` Postgres
 * function (added in migration 0002). The function takes a per-user
 * advisory lock around the check+insert so two parallel /app loads
 * can't both create a "default" workspace.
 *
 * Idempotent on subsequent calls.
 */
export async function ensureUserHasWorkspace(user: {
  id: string;
  email?: string;
  fullName?: string | null;
}): Promise<{ workspaceId: string; created: boolean }> {
  const admin = createSupabaseAdminClient();

  // Fast path — most calls have a workspace already.
  const { data: existing } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.workspace_id) {
    return { workspaceId: existing.workspace_id, created: false };
  }

  const displayName =
    (user.fullName?.trim() || user.email?.split("@")[0] || "Your") + "'s workspace";

  const { data, error } = await admin.rpc("ensure_default_workspace", {
    p_user_id: user.id,
    p_workspace_name: displayName,
  });

  if (error || !data) {
    throw new Error(
      `Failed to ensure workspace: ${error?.message ?? "unknown"}`,
    );
  }

  return { workspaceId: data as string, created: true };
}
