import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage/upload";
import { EXTRACTION_MODEL, getAnthropicClient } from "./claude-client";
import { estimateCostCents } from "./costs";
import {
  CONTRACT_EXTRACTION_SYSTEM_PROMPT,
  EMIT_DOCUMENT_TOOL,
} from "./prompts/contract";
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
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");

  // Build the user turn as a document (PDF) or image. Non-PDF / non-image
  // files we surface as a TODO for M9 (the Word / Excel / plain-text path).
  const userContent = buildDocumentContent(upload.mime_type, base64);
  if (!userContent) {
    throw new Error(
      `MIME type ${upload.mime_type} not supported in milestone 8 (contracts-only PDFs/images). Word / Excel / text fallback lands in milestone 9.`,
    );
  }

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 16000,
    system: [
      {
        type: "text",
        text: CONTRACT_EXTRACTION_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [EMIT_DOCUMENT_TOOL],
    tool_choice: { type: "tool", name: EMIT_DOCUMENT_TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          userContent,
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

import type Anthropic from "@anthropic-ai/sdk";

function buildDocumentContent(
  mimeType: string,
  base64: string,
): Anthropic.ContentBlockParam | null {
  if (mimeType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp") {
    return {
      type: "image",
      source: { type: "base64", media_type: mimeType, data: base64 },
    };
  }
  if (mimeType === "image/gif") {
    return {
      type: "image",
      source: { type: "base64", media_type: "image/gif", data: base64 },
    };
  }
  return null;
}
