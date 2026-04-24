import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Ensures the signed-in user has at least one workspace.
 *
 * First-time signup creates a workspace named "{name}'s workspace" (or
 * "{email}'s workspace" if we don't have a full name yet) and inserts the
 * user as its owner. The workspace_members INSERT has to use the service-
 * role client because the RLS policy gates writes on membership, which
 * doesn't exist yet for a brand-new user.
 *
 * Safe to call on every /app layout load — it's idempotent.
 */
export async function ensureUserHasWorkspace(user: {
  id: string;
  email?: string;
  fullName?: string | null;
}): Promise<{ workspaceId: string; created: boolean }> {
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existing?.workspace_id) {
    return { workspaceId: existing.workspace_id, created: false };
  }

  const displayName =
    (user.fullName?.trim() || user.email?.split("@")[0] || "Your") + "'s workspace";

  const { data: ws, error: wsErr } = await admin
    .from("workspaces")
    .insert({ name: displayName, owner_id: user.id })
    .select("id")
    .single();

  if (wsErr || !ws) {
    throw new Error(`Failed to create workspace: ${wsErr?.message ?? "unknown"}`);
  }

  const { error: memErr } = await admin
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

  if (memErr) {
    throw new Error(`Failed to add owner membership: ${memErr.message}`);
  }

  return { workspaceId: ws.id, created: true };
}
