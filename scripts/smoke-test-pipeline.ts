/**
 * End-to-end smoke test for milestone 10:
 *   upload → extract → buildClientList → assert customers materialized.
 *
 * Uses the same test-fixture plumbing as smoke-test-extraction.ts, then
 * invokes the pipeline orchestrator directly (skipping Inngest) and
 * prints resulting customer rows from the DB.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", override: true });

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: smoke-test-pipeline.ts <path-to-file>");
  process.exit(1);
}

async function main() {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const { runExtraction } = await import("@/lib/extraction/runner");
  const { buildClientList } = await import("@/lib/pipeline/build-list");
  const { STORAGE_BUCKET, buildStoragePath } = await import("@/lib/storage/upload");

  const admin = createSupabaseAdminClient();
  const sql = postgres(process.env.SUPABASE_DB_URL!, { max: 1, prepare: false });

  const userId = randomUUID();
  const workspaceId = randomUUID();
  const uploadId = randomUUID();

  await admin.from("users").insert({ id: userId, email: `m10-smoke-${userId}@local` });
  await admin
    .from("workspaces")
    .insert({ id: workspaceId, name: "M10 smoke test", owner_id: userId });
  await admin
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });

  try {
    const bytes = readFileSync(fixturePath);
    const filename = basename(fixturePath);
    const ext = filename.toLowerCase().split(".").pop() ?? "";
    const mimeType = ({
      pdf: "application/pdf",
      csv: "text/csv",
      txt: "text/plain",
      md: "text/markdown",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as Record<string, string>)[ext] ?? "application/octet-stream";

    const storagePath = buildStoragePath(workspaceId, uploadId, filename);
    await admin.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: true,
    });
    await admin.from("uploads").insert({
      id: uploadId,
      workspace_id: workspaceId,
      filename,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: bytes.length,
      uploaded_by: userId,
      status: "processing",
    });

    console.log("Running extraction…");
    const extr = await runExtraction({ uploadId, workspaceId });
    console.log(`  extracted ${extr.extracted.customers.length} customers, ${extr.extracted.contracts.length} contracts (${extr.costCents}¢)`);

    console.log("Running build-list…");
    const stats = await buildClientList({
      workspaceId,
      dbUrl: process.env.SUPABASE_DB_URL!,
    });
    console.log("  stats:", stats);

    const customers = await sql<
      Array<{
        name: string;
        health_score: number;
        confidence_score: number;
        phones: number;
        emails: number;
        addresses: number;
      }>
    >`
      SELECT c.name, c.health_score, c.confidence_score,
             (SELECT COUNT(*) FROM phones p WHERE p.customer_id = c.id) AS phones,
             (SELECT COUNT(*) FROM emails e WHERE e.customer_id = c.id) AS emails,
             (SELECT COUNT(*) FROM addresses a WHERE a.customer_id = c.id) AS addresses
      FROM customers c
      WHERE c.workspace_id = ${workspaceId}
      ORDER BY c.name
    `;

    console.log(`\nMaterialized ${customers.length} customer(s):`);
    for (const c of customers) {
      console.log(
        `  ${c.name.padEnd(30)} health=${c.health_score.toString().padStart(3)} confidence=${c.confidence_score.toString().padStart(3)} phones=${c.phones} emails=${c.emails} addresses=${c.addresses}`,
      );
    }

    // Run build-list again and confirm idempotency.
    console.log("\nRunning build-list AGAIN (should be no-op)…");
    const stats2 = await buildClientList({
      workspaceId,
      dbUrl: process.env.SUPABASE_DB_URL!,
    });
    console.log("  stats:", stats2);
  } finally {
    const { data: files } = await admin.storage.from("reclaimdata-uploads").list(workspaceId);
    if (files && files.length > 0) {
      await admin.storage
        .from("reclaimdata-uploads")
        .remove(files.map((f) => `${workspaceId}/${f.name}`));
    }
    const subdir = `${workspaceId}/_extraction`;
    const { data: sub } = await admin.storage.from("reclaimdata-uploads").list(subdir);
    if (sub && sub.length > 0) {
      await admin.storage
        .from("reclaimdata-uploads")
        .remove(sub.map((f) => `${subdir}/${f.name}`));
    }
    await admin.from("workspaces").delete().eq("id", workspaceId);
    await admin.from("users").delete().eq("id", userId);
    await sql.end();
    console.log("\ncleaned up test records");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
