import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  company_name: z.string().max(200).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  do_not_contact: z.boolean().optional(),
  primary_phone_id: z.string().uuid().nullable().optional(),
  primary_email_id: z.string().uuid().nullable().optional(),
  primary_address_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("customers")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
