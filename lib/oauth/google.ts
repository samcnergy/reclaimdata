/**
 * Google OAuth 2.0 helpers for the Gmail readonly integration.
 *
 * We hand-roll the OAuth dance instead of pulling googleapis to keep the
 * bundle small. The four primitives below cover the entire flow:
 *
 *   buildAuthorizationUrl()    — start the user's consent
 *   exchangeCodeForTokens()    — handle the callback
 *   refreshAccessToken()       — keep the access token fresh
 *   revokeToken()              — disconnect cleanly
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const SCOPE_GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
};

export function buildAuthorizationUrl(args: {
  redirectUri: string;
  state: string;
  loginHint?: string;
}): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: `${SCOPE_GMAIL_READONLY} email`,
    access_type: "offline", // we need a refresh_token
    prompt: "consent", // force re-consent so we always get refresh_token back
    state: args.state,
  });
  if (args.loginHint) params.set("login_hint", args.loginHint);

  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(args: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not set");
  }

  const body = new URLSearchParams({
    code: args.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(
      `Google token exchange failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET not set");
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(
      `Google refresh failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

/** Pulls the email address out of a Google id_token (no signature verify). */
export function extractEmailFromIdToken(idToken: string): string | null {
  const [, payload] = idToken.split(".");
  if (!payload) return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: string };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}
