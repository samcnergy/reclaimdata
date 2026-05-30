import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/server";
import { ensureUserHasWorkspace } from "@/lib/workspaces/bootstrap";
import { Sidebar } from "@/components/app/sidebar";

/**
 * Auth-gated app shell.
 *
 * - Redirects to /login if no session.
 * - Ensures the user has at least one workspace (creates one on first sign-in).
 * - Paywall: workspaces on plan='free' may only access /app/settings/* (so
 *   they can subscribe, view billing, log out). Every other /app route
 *   redirects to /app/settings/billing/checkout. The plan flips to
 *   'professional' asynchronously via the subscription.created webhook.
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

  // Use the admin client for the workspace lookup so we don't depend on
  // auth.uid() JWT propagation into a fresh RLS transaction in the same
  // request. (The user's permission is already established by the
  // ensureUserHasWorkspace check above.)
  const admin = createSupabaseAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("name, plan")
    .eq("id", workspaceId)
    .single();

  // Paywall enforcement. `x-pathname` is set by proxy.ts so the layout
  // (which sees the same request for every nested /app route) can tell
  // whether it's currently rendering a settings route.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isSettingsRoute = pathname.startsWith("/app/settings");
  const isPaidPlan = workspace?.plan && workspace.plan !== "free";

  if (!isPaidPlan && !isSettingsRoute) {
    redirect("/app/settings/billing/checkout");
  }

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
