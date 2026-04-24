import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkspaceSummary = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  plan: "free" | "starter" | "professional" | "legacy";
};

/**
 * Returns every workspace the authenticated user is a member of. Uses
 * the user-scoped server client so RLS does the filtering.
 */
export async function listUserWorkspaces(): Promise<WorkspaceSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces (id, name, plan)")
    .order("joined_at", { ascending: true });

  if (error) throw error;
  if (!data) return [];

  type JoinedWorkspace = {
    id: string;
    name: string;
    plan: WorkspaceSummary["plan"];
  };

  return data
    .map((row) => {
      // Supabase types the foreign join as an array by default; normalize.
      const joined = row.workspaces as unknown as JoinedWorkspace | JoinedWorkspace[] | null;
      const ws = Array.isArray(joined) ? joined[0] : joined;
      if (!ws) return null;
      return {
        id: ws.id,
        name: ws.name,
        role: row.role as WorkspaceSummary["role"],
        plan: ws.plan,
      } satisfies WorkspaceSummary;
    })
    .filter((x): x is WorkspaceSummary => x !== null);
}
