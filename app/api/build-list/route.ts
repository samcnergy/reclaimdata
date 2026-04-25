import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { buildClientList } from "@/lib/pipeline/build-list";

const RATE_LIMIT = { limit: 3, windowMs: 5 * 60_000 };

// Allow long extractions to finish. Render's hard request cap is 10 min
// for web services; we cap our own work at 9 to leave a margin.
export const maxDuration = 540;

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

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { error: "SUPABASE_DB_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const stats = await buildClientList({ workspaceId: body.workspaceId, dbUrl });
    return NextResponse.json({ ok: true, stats }, { status: 200 });
  } catch (err) {
    console.error("[build-list] failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Build failed",
      },
      { status: 500 },
    );
  }
}
