import { NextResponse } from "next/server";
import archiver from "archiver";
import { Readable } from "node:stream";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Streams a ZIP of CSVs of the user's workspace data:
 *   customers.csv, phones.csv, emails.csv, addresses.csv,
 *   contracts.csv, line_items.csv, notes.csv
 *
 * Membership-checked. Plan-gated to paid tiers — free tier sees the
 * sub-row in Settings but the button is disabled.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("name, plan")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: member } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (workspace.plan === "free") {
    return NextResponse.json(
      { error: "CSV export is available on paid plans." },
      { status: 402 },
    );
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  type QueryFn = () => Promise<{ data: Record<string, unknown>[] | null }> | PromiseLike<{ data: Record<string, unknown>[] | null }>;
  const tables: Array<{ name: string; query: QueryFn }> = [
    {
      name: "customers",
      query: () =>
        admin
          .from("customers")
          .select(
            "id, name, name_prefix, name_suffix, company_name, health_score, confidence_score, last_contract_date, total_contract_value, tags, do_not_contact, created_at, updated_at",
          )
          .eq("workspace_id", workspaceId),
    },
    {
      name: "phones",
      query: () =>
        admin
          .from("phones")
          .select(
            "id, customer_id, raw_value, e164_value, line_type, carrier, validation_status, confidence",
          )
          .eq("workspace_id", workspaceId),
    },
    {
      name: "emails",
      query: () =>
        admin
          .from("emails")
          .select("id, customer_id, raw_value, normalized_value, validation_status, confidence")
          .eq("workspace_id", workspaceId),
    },
    {
      name: "addresses",
      query: () =>
        admin
          .from("addresses")
          .select(
            "id, customer_id, raw_value, line1, line2, city, state, postal_code, country, validation_status, confidence",
          )
          .eq("workspace_id", workspaceId),
    },
    {
      name: "contracts",
      query: () =>
        admin
          .from("contracts")
          .select("id, customer_id, contract_date, amount_cents, scope_of_work, confidence")
          .eq("workspace_id", workspaceId),
    },
    {
      name: "line_items",
      query: () =>
        admin
          .from("line_items")
          .select("id, contract_id, product_type, size, color, quantity, unit_price_cents")
          .eq("workspace_id", workspaceId),
    },
    {
      name: "notes",
      query: () =>
        admin
          .from("notes")
          .select("id, customer_id, author_id, body, created_at")
          .eq("workspace_id", workspaceId),
    },
  ];

  for (const t of tables) {
    const { data } = await t.query();
    archive.append(toCsv(data ?? []), { name: `${t.name}.csv` });
  }

  archive.finalize();

  const stream = Readable.toWeb(archive) as ReadableStream;
  const filename = `reclaimdata-${workspace.name.replace(/[^a-z0-9-_]+/gi, "_")}-${new Date()
    .toISOString()
    .slice(0, 10)}.zip`;

  return new Response(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}
