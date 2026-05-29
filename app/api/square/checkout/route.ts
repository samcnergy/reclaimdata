import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSquareClient } from "@/lib/square/client";

/**
 * POST /api/square/checkout
 *
 * Subscription checkout flow:
 *   1. Receive a Square Web Payments SDK card nonce from the client.
 *   2. Create (or re-use) a Square customer record for the workspace.
 *   3. Save the card on file via Square's Cards API (turns the nonce into a
 *      reusable card_id that the Subscriptions API requires).
 *   4. Create the subscription — the workspace plan is updated asynchronously
 *      when Square fires the subscription.created webhook.
 */

const schema = z.object({
  workspaceId: z.string().uuid(),
  planVariationId: z.string().min(1),
  /** Nonce returned by `card.tokenize()` from the Square Web Payments SDK. */
  cardNonce: z.string().min(1),
});

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

  // ── 1. Load workspace ──────────────────────────────────────────────────────
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, name, square_customer_id, square_subscription_id, owner_id")
    .eq("id", parsed.data.workspaceId)
    .maybeSingle();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Only owners / admins can change billing.
  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.json(
      { error: "Only workspace owners can change billing" },
      { status: 403 },
    );
  }

  if (workspace.square_subscription_id) {
    return NextResponse.json(
      { error: "Workspace already has an active subscription" },
      { status: 409 },
    );
  }

  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) {
    return NextResponse.json(
      { error: "SQUARE_LOCATION_ID not configured" },
      { status: 500 },
    );
  }

  const square = getSquareClient();

  // ── 2. Create Square customer (idempotent — reuse if already exists) ───────
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

  // ── 3. Save card on file (nonce → reusable card_id) ───────────────────────
  // Square's Subscriptions API requires a stored card_id, not a raw nonce.
  const { card } = await square.cards.create({
    idempotencyKey: randomUUID(),
    sourceId: parsed.data.cardNonce,
    card: { customerId },
  });
  if (!card?.id) {
    return NextResponse.json(
      { error: "Failed to save card on file" },
      { status: 500 },
    );
  }

  // ── 4. Create subscription ─────────────────────────────────────────────────
  // workspace.plan is updated to "professional" by the subscription.created
  // webhook — we intentionally don't optimistically update here so the DB is
  // always driven by signed Square events.
  let subscription;
  try {
    ({ subscription } = await square.subscriptions.create({
      idempotencyKey: randomUUID(),
      locationId,
      planVariationId: parsed.data.planVariationId,
      customerId,
      cardId: card.id,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[square.checkout] subscriptions.create failed: ${msg}`);
    return NextResponse.json(
      { error: `Subscription create failed: ${msg}` },
      { status: 500 },
    );
  }

  if (!subscription?.id) {
    return NextResponse.json(
      { error: "Subscription create failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ subscriptionId: subscription.id });
}
