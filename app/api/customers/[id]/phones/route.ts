import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/normalization/phone";

// workspaceId is NOT accepted from the client — it's derived from the
// customer record on the server side to prevent cross-workspace injection.
const schema = z.object({
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

  // Resolve workspace_id server-side (RLS ensures the caller can only read
  // customers in their own workspace, so this doubles as an authz check).
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("workspace_id")
    .eq("id", customerId)
    .single();
  if (custErr || !customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const norm = normalizePhone(parsed.data.rawValue);
  const { data, error } = await supabase
    .from("phones")
    .insert({
      customer_id: customerId,
      workspace_id: customer.workspace_id,
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
