import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const noteSchema = z.object({
  body: z.string().min(1).max(10_000),
  workspaceId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      customer_id: id,
      workspace_id: parsed.data.workspaceId,
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
