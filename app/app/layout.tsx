import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/server";
import { ensureUserHasWorkspace } from "@/lib/workspaces/bootstrap";
import { Sidebar } from "@/components/app/sidebar";

/**
 * Auth-gated app shell.
 *
 * - Redirects to /login if no session.
 * - Ensures the user has at least one workspace (creates one on first sign-in).
 * - Fetches the active workspace for the sidebar.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const { workspaceId } = await ensureUserHasWorkspace({
    id: user.id,
    email: user.email,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  });

  // Use the admin client for the workspace name lookup so we don't depend
  // on auth.uid() JWT propagation into a fresh RLS transaction in the same
  // request. (The user's permission is already established by the
  // ensureUserHasWorkspace check above.)
  const admin = createSupabaseAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();

  return (
    <div className="flex h-screen">
      <Sidebar
        workspaceName={workspace?.name ?? "Your workspace"}
        userEmail={user.email ?? ""}
      />
      <div className="flex flex-1 flex-col overflow-y-auto bg-background">
        {children}
      </div>
    </div>
  );
}
