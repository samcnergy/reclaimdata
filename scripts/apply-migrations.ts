/**
 * Idempotent migration applier.
 *
 * Tracks what's been applied in public.__migrations (filename PK + SHA-256
 * so we can catch post-apply file edits). Runs every .sql under drizzle/
 * that hasn't been applied yet, in filename order, then applies
 * lib/db/rls-policies.sql (this one is idempotent by construction — every
 * policy block is DROP-then-CREATE).
 *
 * Why not drizzle-kit migrate? It requires a TTY. We also apply hand-
 * written RLS SQL it doesn't know about.
 *
 * Usage:
 *   npm run db:apply
 *   SUPABASE_DB_URL=... npm run db:apply   # override target
 */

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
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
  const sql = postgres(connectionString!, { max: 1, prepare: false });

  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.__migrations (
        filename text PRIMARY KEY,
        sha256 text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const existing = await sql<Array<{ filename: string; sha256: string }>>`
      SELECT filename, sha256 FROM public.__migrations
    `;
    const applied = new Map(existing.map((r) => [r.filename, r.sha256]));

    const files = readdirSync(drizzleDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`Target: ${new URL(connectionString!).host}`);
    let freshCount = 0;

    for (const file of files) {
      const content = readFileSync(join(drizzleDir, file), "utf8");
      const sha = createHash("sha256").update(content).digest("hex");
      const previous = applied.get(file);

      if (previous === sha) {
        continue; // already applied, unchanged
      }
      if (previous && previous !== sha) {
        throw new Error(
          `Migration ${file} has been modified after apply (sha differs). Create a new migration instead of editing an old one.`,
        );
      }

      console.log(`→ ${file}`);
      await sql.unsafe(content);
      await sql`
        INSERT INTO public.__migrations (filename, sha256)
        VALUES (${file}, ${sha})
      `;
      freshCount++;
    }

    if (freshCount === 0) {
      console.log("(all drizzle migrations already applied)");
    }

    console.log("→ lib/db/rls-policies.sql (idempotent)");
    await sql.unsafe(readFileSync(rlsFile, "utf8"));

    console.log("Done.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
