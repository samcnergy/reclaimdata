import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAudit } from "@/lib/audit/runner";

export async function POST(request: Request) {
  const user = await requireUser();

  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
  if (!body.workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: membership } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const report = await runAudit({ workspaceId: body.workspaceId, runBy: user.id });
  return NextResponse.json(report, { status: 200 });
}
