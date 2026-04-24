import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const RATE_LIMIT = { limit: 3, windowMs: 5 * 60_000 }; // 3 runs per 5 min per IP

export async function POST(request: Request) {
  const user = await requireUser();

  const limit = rateLimit(
    `build-list:${clientIp(request)}`,
    RATE_LIMIT.limit,
    RATE_LIMIT.windowMs,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many build runs. Wait a few minutes." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
  if (!body.workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  // Confirm the user belongs to the workspace before queuing the job.
  const admin = createSupabaseAdminClient();
  const { data: membership } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of that workspace" }, { status: 403 });
  }

  const ids = await inngest.send({
    name: "pipeline.build-list",
    data: { workspaceId: body.workspaceId },
  });

  return NextResponse.json({ ok: true, eventIds: ids.ids }, { status: 202 });
}
