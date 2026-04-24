/**
 * Tenant isolation smoke test — RLS boundary check.
 *
 * Creates two synthetic users with two workspaces, inserts a distinguishable
 * customer in each, then impersonates each user via
 * `SET request.jwt.claims` (how Supabase's auth.uid() resolves) and asserts
 * that each user sees only their own workspace's data.
 *
 * A fuller end-to-end test (real Supabase Auth, API routes, Storage) lives
 * in milestone 16. This is the database-layer proof that RLS is wired up.
 */

import { config } from "dotenv";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

config({ path: ".env.local", override: true });

const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1, prepare: false });

const userA = randomUUID();
const userB = randomUUID();

async function asUser<T>(uid: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL role authenticated`);
    await tx.unsafe(
      `SELECT set_config('request.jwt.claims', $$${JSON.stringify({ sub: uid, role: "authenticated" })}$$, true)`,
    );
    return fn(tx);
  });
}

async function main() {
  console.log("Seeding two workspaces…");

  // Bootstrap as service role (bypasses RLS).
  await sql`INSERT INTO public.users (id, email) VALUES (${userA}, 'a@rls-test.local') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO public.users (id, email) VALUES (${userB}, 'b@rls-test.local') ON CONFLICT DO NOTHING`;

  const [wsA] = await sql<Array<{ id: string }>>`
    INSERT INTO public.workspaces (name, owner_id) VALUES ('Workspace A', ${userA}) RETURNING id
  `;
  const [wsB] = await sql<Array<{ id: string }>>`
    INSERT INTO public.workspaces (name, owner_id) VALUES ('Workspace B', ${userB}) RETURNING id
  `;

  await sql`INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (${wsA.id}, ${userA}, 'owner')`;
  await sql`INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (${wsB.id}, ${userB}, 'owner')`;

  await sql`INSERT INTO public.customers (workspace_id, name) VALUES (${wsA.id}, 'Alice — in Workspace A')`;
  await sql`INSERT INTO public.customers (workspace_id, name) VALUES (${wsB.id}, 'Bob — in Workspace B')`;

  console.log(`  wsA=${wsA.id}  wsB=${wsB.id}`);

  let failures = 0;

  // --- user A impersonation ---
  console.log("\nUser A queries…");
  const aCustomers = await asUser(userA, (tx) => tx`SELECT name FROM public.customers ORDER BY name`);
  console.log(`  sees customers: ${aCustomers.map((r) => r.name).join(", ") || "(none)"}`);
  if (aCustomers.length !== 1 || !aCustomers[0].name.includes("Workspace A")) {
    console.error("  ✗ expected to see only Workspace A's customer");
    failures++;
  } else {
    console.log("  ✓ sees only Workspace A's customer");
  }

  const aWorkspaces = await asUser(userA, (tx) => tx`SELECT name FROM public.workspaces ORDER BY name`);
  console.log(`  sees workspaces: ${aWorkspaces.map((r) => r.name).join(", ") || "(none)"}`);
  if (aWorkspaces.length !== 1 || aWorkspaces[0].name !== "Workspace A") {
    console.error("  ✗ expected to see only Workspace A");
    failures++;
  } else {
    console.log("  ✓ sees only Workspace A");
  }

  // --- user B impersonation ---
  console.log("\nUser B queries…");
  const bCustomers = await asUser(userB, (tx) => tx`SELECT name FROM public.customers ORDER BY name`);
  console.log(`  sees customers: ${bCustomers.map((r) => r.name).join(", ") || "(none)"}`);
  if (bCustomers.length !== 1 || !bCustomers[0].name.includes("Workspace B")) {
    console.error("  ✗ expected to see only Workspace B's customer");
    failures++;
  } else {
    console.log("  ✓ sees only Workspace B's customer");
  }

  // --- cross-tenant INSERT attempt ---
  console.log("\nUser A attempts cross-workspace INSERT…");
  try {
    await asUser(userA, (tx) =>
      tx`INSERT INTO public.customers (workspace_id, name) VALUES (${wsB.id}, 'Injected by A')`,
    );
    console.error("  ✗ INSERT succeeded (RLS failed!)");
    failures++;
  } catch (err) {
    if (err instanceof Error && /row-level security|policy/i.test(err.message)) {
      console.log("  ✓ INSERT blocked by RLS");
    } else {
      console.error(`  ✗ INSERT failed for wrong reason: ${(err as Error).message}`);
      failures++;
    }
  }

  // --- cleanup (service role) ---
  console.log("\nCleanup…");
  await sql`DELETE FROM public.workspaces WHERE id IN (${wsA.id}, ${wsB.id})`;
  await sql`DELETE FROM public.users WHERE id IN (${userA}, ${userB})`;

  await sql.end();

  if (failures > 0) {
    console.error(`\n✗ ${failures} isolation check(s) failed`);
    process.exit(1);
  }
  console.log("\n✓ tenant isolation verified");
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sql`DELETE FROM public.workspaces WHERE owner_id IN (${userA}, ${userB})`;
    await sql`DELETE FROM public.users WHERE id IN (${userA}, ${userB})`;
  } catch {}
  await sql.end();
  process.exit(1);
});
