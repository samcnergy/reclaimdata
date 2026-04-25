import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  workspaceId: z.string().uuid(),
  line1: z.string().max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
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
  const raw = [
    parsed.data.line1,
    parsed.data.line2,
    parsed.data.city,
    parsed.data.state,
    parsed.data.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
  const { data, error } = await supabase
    .from("addresses")
    .insert({
      customer_id: customerId,
      workspace_id: parsed.data.workspaceId,
      raw_value: raw,
      line1: parsed.data.line1,
      line2: parsed.data.line2 ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state?.toUpperCase() ?? null,
      postal_code: parsed.data.postalCode ?? null,
      country: "US",
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
