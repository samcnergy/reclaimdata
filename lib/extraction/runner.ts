import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/upload";
import { EXTRACTION_MODEL, getAnthropicClient } from "./claude-client";
import { estimateCostCents } from "./costs";
import {
  DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
  EMIT_DOCUMENT_TOOL,
} from "./prompts/document";
import { toClaudeContent } from "./converters";
import { extractedDocumentSchema, type ExtractedDocument } from "./schemas";

const RAW_RESPONSE_BUCKET_PREFIX = "_extraction";

export type ExtractionResult = {
  extractionRunId: string;
  extracted: ExtractedDocument;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  costCents: number;
  durationMs: number;
};

/**
 * Download an upload from Storage, run Claude extraction, persist the
 * extraction_run. Returns the validated structured output.
 *
 * Population of customers / phones / contracts / etc. from this result
 * lives in milestone 10's pipeline (normalize → dedupe → load). This
 * function just produces and persists the structured extraction.
 */
export async function runExtraction(args: {
  uploadId: string;
  workspaceId: string;
}): Promise<ExtractionResult> {
  const admin = createSupabaseAdminClient();
  const anthropic = getAnthropicClient();

  const started = Date.now();

  const { data: upload, error: uploadErr } = await admin
    .from("uploads")
    .select("id, workspace_id, storage_path, mime_type, filename")
    .eq("id", args.uploadId)
    .single();

  if (uploadErr || !upload) {
    throw new Error(
      `Upload ${args.uploadId} not found: ${uploadErr?.message ?? "missing"}`,
    );
  }

  if (upload.workspace_id !== args.workspaceId) {
    throw new Error(
      `Upload ${args.uploadId} belongs to a different workspace`,
    );
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(upload.storage_path);
  if (dlErr || !blob) {
    throw new Error(`Failed to download ${upload.storage_path}: ${dlErr?.message}`);
  }
  const bytes = Buffer.from(await blob.arrayBuffer());

  const converted = await toClaudeContent({
    mimeType: upload.mime_type,
    filename: upload.filename,
    bytes,
  });
  if (!converted) {
    throw new Error(
      `MIME type ${upload.mime_type} is not supported by the extraction pipeline.`,
    );
  }

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [EMIT_DOCUMENT_TOOL],
    tool_choice: { type: "tool", name: EMIT_DOCUMENT_TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          converted.block,
          {
            type: "text",
            text: "Extract everything you can cleanly identify from this document. Emit exactly one call to the emit_document tool.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not invoke the emit_document tool.");
  }

  const parsed = extractedDocumentSchema.parse(toolUse.input);

  const durationMs = Date.now() - started;

  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
  const costCents = estimateCostCents({ model: EXTRACTION_MODEL, ...usage });

  const runId = randomUUID();

  const rawPath = `${args.workspaceId}/${RAW_RESPONSE_BUCKET_PREFIX}/${runId}.json`;
  await admin.storage
    .from(STORAGE_BUCKET)
    .upload(
      rawPath,
      new Blob([JSON.stringify({ response, extracted: parsed }, null, 2)], {
        type: "application/json",
      }),
      { upsert: true },
    );

  const { error: runErr } = await admin.from("extraction_runs").insert({
    id: runId,
    upload_id: args.uploadId,
    workspace_id: args.workspaceId,
    model: EXTRACTION_MODEL,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_cents: costCents,
    duration_ms: durationMs,
    raw_response_storage_path: rawPath,
    status: "completed",
  });
  if (runErr) {
    throw new Error(`Failed to persist extraction_runs row: ${runErr.message}`);
  }

  return { extractionRunId: runId, extracted: parsed, usage, costCents, durationMs };
}
