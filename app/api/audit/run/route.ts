import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAudit } from "@/lib/audit/runner";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const RATE_LIMIT = { limit: 6, windowMs: 60_000 };

export async function POST(request: Request) {
  const user = await requireUser();

  const limit = rateLimit(
    `audit:${clientIp(request)}`,
    RATE_LIMIT.limit,
    RATE_LIMIT.windowMs,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many audit runs. Try again in a minute." },
      { status: 429 },
    );
  }

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
