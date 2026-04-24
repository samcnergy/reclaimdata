/**
 * Verify the DEV Supabase project has the schema + RLS applied.
 * Not a test — a quick reachability + structure check.
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1, prepare: false });

async function main() {
  const tables = await sql<Array<{ table_name: string; rowsecurity: boolean }>>`
    SELECT c.relname AS table_name, c.relrowsecurity AS rowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `;

  const policies = await sql<Array<{ schemaname: string; tablename: string; policyname: string }>>`
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
    ORDER BY schemaname, tablename, policyname
  `;

  const trigger = await sql<Array<{ tgname: string }>>`
    SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  `;

  console.log(`\nTables in public (${tables.length}):`);
  for (const t of tables) {
    console.log(`  ${t.rowsecurity ? "RLS ✓" : "RLS ✗"}  ${t.table_name}`);
  }

  console.log(`\nPolicies (${policies.length}):`);
  const grouped = new Map<string, string[]>();
  for (const p of policies) {
    const key = `${p.schemaname}.${p.tablename}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p.policyname);
  }
  for (const [table, names] of grouped) {
    console.log(`  ${table}: ${names.join(", ")}`);
  }

  console.log(`\nAuth trigger on_auth_user_created: ${trigger.length > 0 ? "✓ present" : "✗ missing"}`);

  const tenantTables = [
    "workspaces",
    "workspace_members",
    "uploads",
    "extraction_runs",
    "customers",
    "phones",
    "emails",
    "addresses",
    "contracts",
    "line_items",
    "notes",
    "duplicate_candidates",
    "audits",
    "email_connections",
  ];
  const rlsDisabled = tables.filter((t) => tenantTables.includes(t.table_name) && !t.rowsecurity);
  if (rlsDisabled.length > 0) {
    console.error(`\n✗ ${rlsDisabled.length} tenant table(s) missing RLS:`, rlsDisabled.map((t) => t.table_name));
    process.exit(1);
  }
  console.log("\n✓ all tenant-scoped tables have RLS enabled");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
