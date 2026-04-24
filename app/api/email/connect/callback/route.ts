import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/crypto/encrypt";
import {
  exchangeCodeForTokens,
  extractEmailFromIdToken,
} from "@/lib/oauth/google";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("rd_oauth_state")?.value;
  const workspaceId = cookieStore.get("rd_oauth_workspace")?.value;

  // Always clear the cookies — single-use.
  const response = NextResponse.redirect(
    new URL("/app/upload?email=connected", url.origin),
  );
  response.cookies.delete("rd_oauth_state");
  response.cookies.delete("rd_oauth_workspace");

  if (error) {
    return NextResponse.redirect(
      new URL(`/app/upload?email=denied&reason=${encodeURIComponent(error)}`, url.origin),
    );
  }
  if (!code || !state || !expectedState || state !== expectedState || !workspaceId) {
    return NextResponse.redirect(
      new URL("/app/upload?email=denied&reason=state_mismatch", url.origin),
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${appUrl}/api/email/connect/callback`;

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, redirectUri });
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        `/app/upload?email=denied&reason=${encodeURIComponent(err instanceof Error ? err.message : "exchange_failed")}`,
        url.origin,
      ),
    );
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      new URL(
        "/app/upload?email=denied&reason=no_refresh_token",
        url.origin,
      ),
    );
  }

  const emailAddress =
    extractEmailFromIdToken(tokens.id_token ?? "") ?? user.email ?? "unknown";

  const admin = createSupabaseAdminClient();
  await admin.from("email_connections").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    provider: "gmail",
    email_address: emailAddress,
    encrypted_access_token: encryptToken(tokens.access_token),
    encrypted_refresh_token: encryptToken(tokens.refresh_token),
  });

  return response;
}
