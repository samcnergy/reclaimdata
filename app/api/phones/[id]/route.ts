import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/normalization/phone";

const patchSchema = z.object({
  rawValue: z.string().min(1).max(60).optional(),
  isPrimary: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = await createSupabaseServerClient();

  const update: Record<string, unknown> = {};
  if (parsed.data.rawValue !== undefined) {
    update.raw_value = parsed.data.rawValue;
    const norm = normalizePhone(parsed.data.rawValue);
    update.e164_value = norm.e164;
    update.validation_status = "unvalidated";
    update.validation_checked_at = null;
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("phones").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.isPrimary) {
    const { data: phone } = await supabase
      .from("phones")
      .select("customer_id")
      .eq("id", id)
      .maybeSingle();
    if (phone?.customer_id) {
      await supabase
        .from("customers")
        .update({ primary_phone_id: id, updated_at: new Date().toISOString() })
        .eq("id", phone.customer_id);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Clear primary_phone_id on the parent customer if this row was primary,
  // so the FK pointer doesn't dangle (the column is unconstrained but the
  // UI relies on resolving the primary via the join).
  const { data: phone } = await supabase
    .from("phones")
    .select("customer_id")
    .eq("id", id)
    .maybeSingle();
  if (phone?.customer_id) {
    await supabase
      .from("customers")
      .update({ primary_phone_id: null })
      .eq("id", phone.customer_id)
      .eq("primary_phone_id", id);
  }

  const { error } = await supabase.from("phones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
