import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSquareClient } from "@/lib/square/client";

const schema = z.object({
  workspaceId: z.string().uuid(),
  action: z.enum(["cancel", "swap"]),
  newPlanVariationId: z.string().min(1).optional(),
});

/**
 * Self-service billing actions. Square doesn't expose a hosted customer
 * portal so we wrap the relevant subscription lifecycle calls here:
 *
 *   action: "cancel"  → cancel at period end
 *   action: "swap"    → swap to a new plan variation (cancel current
 *                       at period end, create new starting then)
 */
export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, square_subscription_id")
    .eq("id", parsed.data.workspaceId)
    .maybeSingle();
  if (!workspace?.square_subscription_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.json({ error: "Only workspace owners can change billing" }, { status: 403 });
  }

  const square = getSquareClient();

  if (parsed.data.action === "cancel") {
    await square.subscriptions.cancel({
      subscriptionId: workspace.square_subscription_id,
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "swap") {
    if (!parsed.data.newPlanVariationId) {
      return NextResponse.json({ error: "newPlanVariationId required" }, { status: 400 });
    }
    await square.subscriptions.swapPlan({
      subscriptionId: workspace.square_subscription_id,
      newPlanVariationId: parsed.data.newPlanVariationId,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
