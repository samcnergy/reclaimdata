import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json().catch(() => ({}))) as { connectionId?: string };
  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: conn } = await admin
    .from("email_connections")
    .select("user_id, workspace_id")
    .eq("id", body.connectionId)
    .maybeSingle();
  if (!conn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conn.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await inngest.send({
    name: "extraction.email.sync",
    data: { connectionId: body.connectionId, workspaceId: conn.workspace_id },
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}
