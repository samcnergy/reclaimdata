import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/server";
import { ensureUserHasWorkspace } from "@/lib/workspaces/bootstrap";

export type ActiveWorkspaceContext = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  workspace: {
    id: string;
    name: string;
    plan: "free" | "starter" | "professional" | "legacy";
  };
};

/**
 * Resolves the authenticated user plus their active workspace in a single
 * call. Every server component under /app should funnel through this so
 * the sidebar's workspace label stays in lockstep with whatever the page
 * queries against.
 */
export async function getActiveWorkspaceContext(): Promise<ActiveWorkspaceContext> {
  const user = await requireUser();

  const { workspaceId } = await ensureUserHasWorkspace({
    id: user.id,
    email: user.email,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .select("id, name, plan")
    .eq("id", workspaceId)
    .single();

  if (error || !data) {
    throw new Error(`Workspace ${workspaceId} not found: ${error?.message}`);
  }

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
    },
    workspace: {
      id: data.id,
      name: data.name,
      plan: data.plan as ActiveWorkspaceContext["workspace"]["plan"],
    },
  };
}
