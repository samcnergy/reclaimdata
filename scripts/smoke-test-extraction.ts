/**
 * End-to-end smoke test for milestone 8.
 *
 * Uploads a fixture PDF to Storage, creates an uploads row, invokes the
 * extraction runner, and prints the structured output. Cleans up after.
 *
 * Usage:
 *   npx tsx scripts/smoke-test-extraction.ts <path-to-pdf>
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const fixturePath = process.argv[2];
if (!fixturePath) {
  console.error("usage: smoke-test-extraction.ts <path-to-pdf-or-image>");
  process.exit(1);
}

async function main() {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const { runExtraction } = await import("@/lib/extraction/runner");
  const { STORAGE_BUCKET, buildStoragePath } = await import("@/lib/storage/upload");
  const admin = createSupabaseAdminClient();

  // Seed a test workspace + user scoped to this run.
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const uploadId = randomUUID();

  await admin.from("users").insert({ id: userId, email: `m8-smoke-${userId}@local` });
  await admin
    .from("workspaces")
    .insert({ id: workspaceId, name: "M8 smoke test", owner_id: userId });
  await admin
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });

  try {
    const bytes = readFileSync(fixturePath);
    const filename = basename(fixturePath);
    const mimeType = filename.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : filename.match(/\.(png|jpg|jpeg|webp)$/i)
        ? `image/${filename.split(".").pop()!.toLowerCase().replace("jpg", "jpeg")}`
        : "application/octet-stream";
    const storagePath = buildStoragePath(workspaceId, uploadId, filename);

    console.log(`Uploading ${filename} (${bytes.length} bytes, ${mimeType}) to ${storagePath}`);
    const { error: upErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType: mimeType, upsert: true });
    if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

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

    console.log("Running extraction via Claude Sonnet 4.6…");
    const result = await runExtraction({ uploadId, workspaceId });

    console.log("\n=== extraction result ===");
    console.log(`document_type: ${result.extracted.document_type}`);
    console.log(`customers: ${result.extracted.customers.length}`);
    console.log(`contracts: ${result.extracted.contracts.length}`);
    console.log(`cost: ${result.costCents}¢`);
    console.log(`duration: ${result.durationMs}ms`);
    console.log(
      `tokens: in=${result.usage.inputTokens} out=${result.usage.outputTokens} cache_read=${result.usage.cacheReadTokens} cache_write=${result.usage.cacheCreationTokens}`,
    );
    console.log(`\nextraction_runs.id=${result.extractionRunId}`);
    console.log(`first customer:`, JSON.stringify(result.extracted.customers[0], null, 2));
    console.log(`first contract:`, JSON.stringify(result.extracted.contracts[0], null, 2));
  } finally {
    // Cleanup: storage objects, uploads/extraction_runs (cascade), workspace (cascade), user.
    const { data: files } = await admin.storage.from("reclaimdata-uploads").list(workspaceId);
    if (files && files.length > 0) {
      await admin.storage
        .from("reclaimdata-uploads")
        .remove(files.map((f) => `${workspaceId}/${f.name}`));
    }
    const subdir = `${workspaceId}/_extraction`;
    const { data: subFiles } = await admin.storage.from("reclaimdata-uploads").list(subdir);
    if (subFiles && subFiles.length > 0) {
      await admin.storage
        .from("reclaimdata-uploads")
        .remove(subFiles.map((f) => `${subdir}/${f.name}`));
    }
    await admin.from("workspaces").delete().eq("id", workspaceId);
    await admin.from("users").delete().eq("id", userId);
    console.log("\ncleaned up test records");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
