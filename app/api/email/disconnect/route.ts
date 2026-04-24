import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto/encrypt";
import { revokeToken } from "@/lib/oauth/google";

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json().catch(() => ({}))) as {
    connectionId?: string;
  };
  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: conn } = await admin
    .from("email_connections")
    .select("id, user_id, encrypted_refresh_token")
    .eq("id", body.connectionId)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conn.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Best-effort revoke: if Google returns an error we still delete locally.
  try {
    await revokeToken(decryptToken(conn.encrypted_refresh_token));
  } catch (err) {
    console.error("[email/disconnect] revoke failed:", err);
  }

  await admin.from("email_connections").delete().eq("id", conn.id);
  return NextResponse.json({ ok: true });
}
