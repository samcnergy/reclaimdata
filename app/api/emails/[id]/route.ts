import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/normalization/email";

const patchSchema = z.object({
  rawValue: z.string().min(1).max(254).optional(),
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
    const norm = normalizeEmail(parsed.data.rawValue);
    update.normalized_value = norm.normalized;
    update.validation_status = "unvalidated";
    update.validation_checked_at = null;
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("emails").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (parsed.data.isPrimary) {
    const { data: email } = await supabase
      .from("emails")
      .select("customer_id")
      .eq("id", id)
      .maybeSingle();
    if (email?.customer_id) {
      await supabase
        .from("customers")
        .update({ primary_email_id: id, updated_at: new Date().toISOString() })
        .eq("id", email.customer_id);
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
  const { data: email } = await supabase
    .from("emails")
    .select("customer_id")
    .eq("id", id)
    .maybeSingle();
  if (email?.customer_id) {
    await supabase
      .from("customers")
      .update({ primary_email_id: null })
      .eq("id", email.customer_id)
      .eq("primary_email_id", id);
  }
  const { error } = await supabase.from("emails").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
