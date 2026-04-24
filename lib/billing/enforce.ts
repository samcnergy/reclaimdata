import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLANS, type Plan } from "./plans";

export type LimitCheck =
  | { ok: true; remaining: number | null; soft: false }
  | { ok: true; remaining: number; soft: true } // approaching cap
  | { ok: false; remaining: 0; soft: false; message: string };

/** customers, uploads, emailConnections, users — current counts per workspace. */
export async function getWorkspaceUsage(workspaceId: string): Promise<{
  customers: number;
  uploads: number;
  emailConnections: number;
  users: number;
}> {
  const admin = createSupabaseAdminClient();
  const [c, u, ec, mem] = await Promise.all([
    admin.from("customers").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("uploads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("email_connections").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  return {
    customers: c.count ?? 0,
    uploads: u.count ?? 0,
    emailConnections: ec.count ?? 0,
    users: mem.count ?? 0,
  };
}

export async function checkLimit(args: {
  workspaceId: string;
  plan: Plan;
  resource: keyof Awaited<ReturnType<typeof getWorkspaceUsage>>;
  delta?: number; // default 1 — how many we're trying to add
}): Promise<LimitCheck> {
  const { workspaceId, plan, resource } = args;
  const delta = args.delta ?? 1;
  const limit = PLANS[plan][resource];

  if (limit === 0) {
    // unlimited on this plan
    return { ok: true, remaining: null, soft: false };
  }

  const usage = await getWorkspaceUsage(workspaceId);
  const projected = usage[resource] + delta;

  if (projected > limit) {
    return {
      ok: false,
      remaining: 0,
      soft: false,
      message: `Your ${plan} plan allows ${limit} ${resource}. Upgrade to add more.`,
    };
  }
  if (projected / limit >= 0.8) {
    return { ok: true, remaining: limit - projected, soft: true };
  }
  return { ok: true, remaining: limit - projected, soft: false };
}
