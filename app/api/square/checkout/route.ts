import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSquareClient } from "@/lib/square/client";

const schema = z.object({
  workspaceId: z.string().uuid(),
  planVariationId: z.string().min(1),
  cardId: z.string().min(1).optional(),
});

/**
 * Creates a Square subscription for the workspace. Square requires a
 * customer + a card on file before subscribing — for v1 we expect the
 * Web Payments SDK on the client to tokenize the card and pass the
 * card ID up.
 *
 * In sandbox you can also test with the "cnon:card-nonce-ok" stub.
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
    .select("id, name, square_customer_id, square_subscription_id, owner_id")
    .eq("id", parsed.data.workspaceId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Membership check: only owners/admins can change billing.
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
  let customerId = workspace.square_customer_id;

  if (!customerId) {
    const { customer } = await square.customers.create({
      idempotencyKey: randomUUID(),
      emailAddress: user.email ?? undefined,
      referenceId: workspace.id,
      companyName: workspace.name,
    });
    if (!customer?.id) {
      return NextResponse.json(
        { error: "Failed to create Square customer" },
        { status: 500 },
      );
    }
    customerId = customer.id;
    await admin
      .from("workspaces")
      .update({ square_customer_id: customerId })
      .eq("id", workspace.id);
  }

  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) {
    return NextResponse.json({ error: "SQUARE_LOCATION_ID not configured" }, { status: 500 });
  }

  const { subscription } = await square.subscriptions.create({
    idempotencyKey: randomUUID(),
    locationId,
    planVariationId: parsed.data.planVariationId,
    customerId,
    cardId: parsed.data.cardId,
  });

  if (!subscription?.id) {
    return NextResponse.json({ error: "Subscription create failed" }, { status: 500 });
  }

  // Workspace plan flips on the subscription.created webhook. We don't
  // optimistically update here so the source of truth is always the
  // signed webhook event.
  return NextResponse.json({
    subscriptionId: subscription.id,
    customerId,
  });
}
