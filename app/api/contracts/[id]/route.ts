import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  contractDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD")
    .nullable()
    .optional(),
  amountCents: z.number().int().nullable().optional(),
  scopeOfWork: z.string().max(2000).nullable().optional(),
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
  const update: Record<string, unknown> = {};
  if (parsed.data.contractDate !== undefined) update.contract_date = parsed.data.contractDate;
  if (parsed.data.amountCents !== undefined) update.amount_cents = parsed.data.amountCents;
  if (parsed.data.scopeOfWork !== undefined) update.scope_of_work = parsed.data.scopeOfWork;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contracts").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  // line_items cascades via FK
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
