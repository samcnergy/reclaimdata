import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/normalization/phone";

const schema = z.object({
  workspaceId: z.string().uuid(),
  rawValue: z.string().min(1).max(60),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id: customerId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const supabase = await createSupabaseServerClient();
  const norm = normalizePhone(parsed.data.rawValue);
  const { data, error } = await supabase
    .from("phones")
    .insert({
      customer_id: customerId,
      workspace_id: parsed.data.workspaceId,
      raw_value: parsed.data.rawValue,
      e164_value: norm.e164,
      confidence: 100,
      validation_status: "unvalidated",
      source_refs: [{ kind: "manual" }],
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
