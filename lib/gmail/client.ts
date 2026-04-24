/**
 * Gmail REST client. Auto-refreshes the access token when a 401 surfaces.
 * Returns plain JSON (no googleapis dependency).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/crypto/encrypt";
import { refreshAccessToken } from "@/lib/oauth/google";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

type GmailHeader = { name: string; value: string };

export type GmailMessageMeta = {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: GmailHeader[];
    parts?: GmailMessagePart[];
    body?: { data?: string; size?: number };
    mimeType?: string;
  };
  internalDate: string;
};

export type GmailMessagePart = {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
};

export class GmailClient {
  constructor(private connectionId: string) {}

  private async getAccessToken(): Promise<string> {
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("email_connections")
      .select("encrypted_access_token, encrypted_refresh_token")
      .eq("id", this.connectionId)
      .single();

    if (!row) throw new Error(`email_connections row ${this.connectionId} missing`);
    return decryptToken(row.encrypted_access_token);
  }

  private async refreshAndPersist(): Promise<string> {
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("email_connections")
      .select("encrypted_refresh_token")
      .eq("id", this.connectionId)
      .single();

    if (!row) throw new Error(`email_connections row ${this.connectionId} missing`);

    const fresh = await refreshAccessToken(decryptToken(row.encrypted_refresh_token));
    await admin
      .from("email_connections")
      .update({ encrypted_access_token: encryptToken(fresh.access_token) })
      .eq("id", this.connectionId);
    return fresh.access_token;
  }

  private async fetchWithRefresh(path: string): Promise<Response> {
    let token = await this.getAccessToken();
    let res = await fetch(`${GMAIL_BASE}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      token = await this.refreshAndPersist();
      res = await fetch(`${GMAIL_BASE}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
    }
    return res;
  }

  async listMessageIds(args: {
    query: string; // e.g. "in:sent newer_than:5y"
    maxResults?: number;
    pageToken?: string;
  }): Promise<{ ids: string[]; nextPageToken?: string }> {
    const params = new URLSearchParams({
      q: args.query,
      maxResults: String(args.maxResults ?? 100),
    });
    if (args.pageToken) params.set("pageToken", args.pageToken);

    const res = await this.fetchWithRefresh(
      `/users/me/messages?${params.toString()}`,
    );
    if (!res.ok) {
      throw new Error(`gmail list: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    return {
      ids: (data.messages ?? []).map((m) => m.id),
      nextPageToken: data.nextPageToken,
    };
  }

  async getMessage(id: string): Promise<GmailMessageMeta> {
    const res = await this.fetchWithRefresh(
      `/users/me/messages/${id}?format=full`,
    );
    if (!res.ok) {
      throw new Error(`gmail get ${id}: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as GmailMessageMeta;
  }
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function flattenTextParts(payload: GmailMessageMeta["payload"]): string {
  const out: string[] = [];
  const visit = (part: GmailMessagePart) => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      out.push(decodeBase64Url(part.body.data));
    } else if (part.parts) {
      for (const p of part.parts) visit(p);
    }
  };
  if (payload.body?.data && payload.mimeType?.startsWith("text/plain")) {
    out.push(decodeBase64Url(payload.body.data));
  }
  for (const p of payload.parts ?? []) visit(p);
  return out.join("\n\n").trim();
}

export function getHeader(payload: GmailMessageMeta["payload"], name: string): string | null {
  const found = payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}
