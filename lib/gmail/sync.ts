/**
 * Pulls a batch of recent emails for a connection, packages each one as a
 * "synthetic upload" for the extractor, and runs Claude over the body.
 *
 * Why route through extraction_runs at all? It keeps everything in one
 * pipeline: extract → dedupe → load → validate. Emails extracted this
 * way appear in the same customer list with the same source-linkback as
 * uploaded documents, so the user has one place to look.
 *
 * For M14 we keep the per-run cap small (50 messages, sent folder, last
 * 5 years) so a Gmail connection doesn't accidentally rip through a
 * decade of inbox in one go. Pagination + a per-connection
 * `last_synced_message_id` watermark land in M16/M17 polish.
 */

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runExtraction } from "@/lib/extraction/runner";
import { STORAGE_BUCKET, buildStoragePath } from "@/lib/storage/upload";
import { GmailClient, flattenTextParts, getHeader } from "@/lib/gmail/client";

const PER_RUN_CAP = 50;
const QUERY = "in:sent newer_than:5y";

export type EmailSyncStats = {
  messagesFetched: number;
  uploadsCreated: number;
  errors: number;
};

export async function syncEmailConnection(args: {
  connectionId: string;
}): Promise<EmailSyncStats> {
  const admin = createSupabaseAdminClient();

  const { data: connection, error: connErr } = await admin
    .from("email_connections")
    .select("id, workspace_id, user_id, email_address")
    .eq("id", args.connectionId)
    .single();
  if (connErr || !connection) {
    throw new Error(`email_connections ${args.connectionId} missing: ${connErr?.message}`);
  }

  const gmail = new GmailClient(connection.id);
  const { ids } = await gmail.listMessageIds({
    query: QUERY,
    maxResults: PER_RUN_CAP,
  });

  const stats: EmailSyncStats = {
    messagesFetched: 0,
    uploadsCreated: 0,
    errors: 0,
  };

  for (const messageId of ids) {
    try {
      const message = await gmail.getMessage(messageId);
      stats.messagesFetched++;

      const subject = getHeader(message.payload, "Subject") ?? "(no subject)";
      const from = getHeader(message.payload, "From") ?? "";
      const to = getHeader(message.payload, "To") ?? "";
      const cc = getHeader(message.payload, "Cc") ?? "";
      const date = getHeader(message.payload, "Date") ?? "";
      const body = flattenTextParts(message.payload);

      const synthetic = [
        `Subject: ${subject}`,
        `From: ${from}`,
        `To: ${to}`,
        cc ? `Cc: ${cc}` : "",
        `Date: ${date}`,
        "",
        body || "(no plain-text body)",
      ]
        .filter(Boolean)
        .join("\n");

      const filename = `gmail-${messageId}.txt`;
      const uploadId = randomUUID();
      const storagePath = buildStoragePath(connection.workspace_id, uploadId, filename);

      const { error: upErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, new Blob([synthetic], { type: "text/plain" }), {
          contentType: "text/plain",
          upsert: false,
        });
      if (upErr && !upErr.message.includes("already exists")) {
        throw new Error(`storage: ${upErr.message}`);
      }

      const { error: insertErr } = await admin.from("uploads").insert({
        id: uploadId,
        workspace_id: connection.workspace_id,
        filename: `${subject.slice(0, 80)} (Gmail)`,
        storage_path: storagePath,
        mime_type: "text/plain",
        size_bytes: Buffer.byteLength(synthetic),
        page_count: 1,
        uploaded_by: connection.user_id,
        status: "processing",
      });
      if (insertErr) throw new Error(`uploads insert: ${insertErr.message}`);

      // Run the extractor synchronously so the gmail-sourced "upload"
      // gets a real extraction_run + its customers/contracts surface
      // when the user next clicks "Build my client list".
      await runExtraction({ uploadId, workspaceId: connection.workspace_id });
      await admin
        .from("uploads")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", uploadId);

      stats.uploadsCreated++;
    } catch (err) {
      stats.errors++;
      console.error(
        `[gmail.sync] message ${messageId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  await admin
    .from("email_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connection.id);

  return stats;
}
