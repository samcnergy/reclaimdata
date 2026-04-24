import { NextResponse } from "next/server";

import { verifySquareSignature } from "@/lib/square/webhook";
import { lookupPlanByVariationId } from "@/lib/billing/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Square webhook handler. Validates the HMAC signature, then dispatches
 * on event type. The 10 events we subscribed to (per SETUP_LOG Service 9)
 * collapse into three jobs:
 *
 *   subscription.created / subscription.updated   → set workspace.plan
 *   subscription.canceled                          → revert workspace to 'free'
 *   invoice.payment_made / invoice.scheduled_charge_failed / etc.
 *                                                  → audit log only (M16+)
 */

const HANDLED = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "invoice.created",
  "invoice.updated",
  "invoice.published",
  "invoice.payment_made",
  "invoice.canceled",
  "invoice.deleted",
  "invoice.refunded",
  "invoice.scheduled_charge_failed",
]);

export async function POST(request: Request) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!signatureKey) {
    return NextResponse.json(
      { error: "SQUARE_WEBHOOK_SIGNATURE_KEY not configured" },
      { status: 500 },
    );
  }

  const bodyText = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  const notificationUrl =
    process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/square/webhook`
      : new URL(request.url).toString();

  if (!verifySquareSignature({
    signatureHeader: signature,
    notificationUrl,
    bodyText,
    signatureKey,
  })) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!event.type || !HANDLED.has(event.type)) {
    return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const admin = createSupabaseAdminClient();

  if (event.type === "subscription.created" || event.type === "subscription.updated") {
    const sub = event.data?.object?.subscription as
      | { id?: string; customer_id?: string; plan_variation_id?: string }
      | undefined;
    if (!sub?.id || !sub.plan_variation_id || !sub.customer_id) {
      return NextResponse.json({ ok: true, skipped: "missing subscription fields" });
    }
    const planLookup = lookupPlanByVariationId(sub.plan_variation_id);
    if (!planLookup) {
      console.error(
        `[square.webhook] unknown plan_variation_id ${sub.plan_variation_id}`,
      );
      return NextResponse.json({ ok: true, skipped: "unknown plan" });
    }
    const { error } = await admin
      .from("workspaces")
      .update({
        plan: planLookup.plan,
        square_customer_id: sub.customer_id,
        square_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      })
      .eq("square_customer_id", sub.customer_id);
    if (error) {
      console.error(`[square.webhook] update workspace failed: ${error.message}`);
    }
    return NextResponse.json({ ok: true, plan: planLookup.plan });
  }

  if (event.type === "subscription.canceled") {
    const sub = event.data?.object?.subscription as { id?: string } | undefined;
    if (!sub?.id) return NextResponse.json({ ok: true, skipped: "no sub id" });
    await admin
      .from("workspaces")
      .update({
        plan: "free",
        square_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("square_subscription_id", sub.id);
    return NextResponse.json({ ok: true, plan: "free" });
  }

  // Invoice events: log + acknowledge for now. Future: write to an
  // invoices/audit_log table for the billing UI to display.
  return NextResponse.json({ ok: true });
}
