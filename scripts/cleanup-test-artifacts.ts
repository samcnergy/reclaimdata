/**
 * Best-effort scrubber for dev / smoke-test artifacts.
 *
 *   npx tsx scripts/cleanup-test-artifacts.ts <email>
 *
 * Deletes (in order):
 *   - storage objects under {workspaceId}/...
 *   - uploads + customers + (cascaded children) for the user's workspaces
 *   - workspaces owned by the user
 *   - public.users row for the user
 *   - auth.users via admin API
 */

import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const email = process.argv[2];
if (!email) {
  console.error("usage: cleanup-test-artifacts.ts <email>");
  process.exit(1);
}

const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1, prepare: false });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "reclaimdata-uploads";

async function main() {
  const users = await sql<Array<{ id: string }>>`
    SELECT id FROM public.users WHERE email = ${email}
  `;
  if (users.length === 0) {
    console.log("no public.users row found for", email);
  }

  for (const u of users) {
    const workspaces = await sql<Array<{ id: string }>>`
      SELECT id FROM workspaces WHERE owner_id = ${u.id}
    `;
    for (const ws of workspaces) {
      const { data: files } = await admin.storage.from(bucket).list(ws.id);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${ws.id}/${f.name}`);
        await admin.storage.from(bucket).remove(paths);
        console.log(`storage: removed ${paths.length} object(s) from ${ws.id}/`);
      }
      await sql`DELETE FROM workspaces WHERE id = ${ws.id}`;
      console.log(`workspaces: deleted ${ws.id}`);
    }
    await sql`DELETE FROM public.users WHERE id = ${u.id}`;
    console.log(`public.users: deleted ${u.id}`);
  }

  const { data: authList } = await admin.auth.admin.listUsers();
  const authUser = authList?.users.find((u) => u.email === email);
  if (authUser) {
    await admin.auth.admin.deleteUser(authUser.id);
    console.log(`auth.users: deleted ${authUser.id}`);
  }

  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await sql.end();
  } catch {}
  process.exit(1);
});
