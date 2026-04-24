/**
 * One-shot migration applier.
 *
 * Why this exists: `drizzle-kit push` requires a TTY for interactive
 * confirmations, and we also need to apply hand-written RLS policy SQL
 * that drizzle-kit doesn't know about. This script runs both in order
 * against whichever database `SUPABASE_DB_URL` points at.
 *
 * Usage:
 *   npm run db:apply             # applies 0000_initial_schema.sql + rls-policies.sql
 *   SUPABASE_DB_URL=... npm run db:apply  # override target
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", override: true });
config({ path: ".env" });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set. Aborting.");
  process.exit(1);
}

const drizzleDir = join(process.cwd(), "drizzle");
const rlsFile = join(process.cwd(), "lib", "db", "rls-policies.sql");

async function main() {
  const sql = postgres(connectionString!, {
    max: 1,
    prepare: false,
    onnotice: (n) => {
      if (n.severity !== "NOTICE") console.log(`[db] ${n.severity}: ${n.message}`);
    },
  });

  try {
    const migrationFiles = readdirSync(drizzleDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`Applying ${migrationFiles.length} Drizzle migration(s) + RLS policies`);
    console.log(`  target: ${new URL(connectionString!).host}`);

    for (const file of migrationFiles) {
      const path = join(drizzleDir, file);
      const content = readFileSync(path, "utf8");
      console.log(`→ ${file}`);
      await sql.unsafe(content);
    }

    console.log("→ lib/db/rls-policies.sql");
    const rlsContent = readFileSync(rlsFile, "utf8");
    await sql.unsafe(rlsContent);

    console.log("Done.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
