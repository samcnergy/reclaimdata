import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// workspaceId is NOT accepted from the client — it's derived from the
// customer record on the server side to prevent cross-workspace injection.
const noteSchema = z.object({
  body: z.string().min(1).max(10_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id: customerId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
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

  const { data, error } = await supabase
    .from("notes")
    .insert({
      customer_id: customerId,
      workspace_id: customer.workspace_id,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, createdAt: data.created_at }, { status: 201 });
}
