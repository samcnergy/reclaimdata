import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { requireUser } from "@/lib/auth/server";
import { buildAuthorizationUrl } from "@/lib/oauth/google";

/**
 * Starts the Google OAuth flow. Stores a one-time `state` token in a
 * short-lived cookie so the callback can verify the redirect wasn't
 * forged. Caller (the Email tab) just hits this and is redirected to
 * Google's consent page.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${appUrl}/api/email/connect/callback`;
  const state = randomBytes(24).toString("base64url");

  const authUrl = buildAuthorizationUrl({
    redirectUri,
    state,
    loginHint: user.email ?? undefined,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("rd_oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: appUrl.startsWith("https://"),
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
  });
  response.cookies.set("rd_oauth_workspace", workspaceId, {
    path: "/",
    httpOnly: true,
    secure: appUrl.startsWith("https://"),
    sameSite: "lax",
    maxAge: 60 * 10,
  });
  return response;
}
