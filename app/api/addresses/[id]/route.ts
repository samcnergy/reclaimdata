import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  line1: z.string().max(200).nullable().optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(40).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
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
  if (parsed.data.line1 !== undefined) update.line1 = parsed.data.line1;
  if (parsed.data.line2 !== undefined) update.line2 = parsed.data.line2;
  if (parsed.data.city !== undefined) update.city = parsed.data.city;
  if (parsed.data.state !== undefined) update.state = parsed.data.state?.toUpperCase() ?? null;
  if (parsed.data.postalCode !== undefined) update.postal_code = parsed.data.postalCode;

  // Any structural change re-opens validation. The next build-list /
  // explicit re-validate run will hit USPS again.
  if (Object.keys(update).length > 0) {
    update.validation_status = "unvalidated";
    update.validation_checked_at = null;
    // raw_value stays as-is — it's the immutable extraction record.
    const { error } = await supabase.from("addresses").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.isPrimary) {
    const { data: addr } = await supabase
      .from("addresses")
      .select("customer_id")
      .eq("id", id)
      .maybeSingle();
    if (addr?.customer_id) {
      await supabase
        .from("customers")
        .update({ primary_address_id: id, updated_at: new Date().toISOString() })
        .eq("id", addr.customer_id);
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
  const { data: addr } = await supabase
    .from("addresses")
    .select("customer_id")
    .eq("id", id)
    .maybeSingle();
  if (addr?.customer_id) {
    await supabase
      .from("customers")
      .update({ primary_address_id: null })
      .eq("id", addr.customer_id)
      .eq("primary_address_id", id);
  }
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
