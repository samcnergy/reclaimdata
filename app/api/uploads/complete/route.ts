import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

/**
 * Called by the browser after a file has finished uploading directly to
 * Supabase Storage. Writes a row into `public.uploads` (RLS scopes by
 * workspace) and fires an Inngest event to kick off extraction.
 *
 * We trust the caller to supply a `storagePath` that starts with the
 * workspaceId — RLS on storage.objects already enforces that the user
 * could only write there if they're a member of that workspace, and the
 * INSERT into `uploads` below is further filtered by the uploads RLS
 * policy.
 */

const schema = z.object({
  workspaceId: z.string().uuid(),
  storagePath: z.string().min(1).max(1024),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative().max(200 * 1024 * 1024),
});

export async function POST(request: Request) {
  const user = await requireUser();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { workspaceId, storagePath, filename, mimeType, sizeBytes } = parsed.data;

  if (!storagePath.startsWith(`${workspaceId}/`)) {
    return NextResponse.json(
      { error: "storagePath must start with the workspaceId segment" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("uploads")
    .insert({
      workspace_id: workspaceId,
      filename,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      uploaded_by: user.id,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }

  // Best-effort enqueue. If Inngest is unreachable the upload is still
  // durably recorded — a periodic sweeper job can pick up orphan 'queued'
  // rows (wire in milestone 16).
  try {
    await inngest.send({
      name: "extraction.file.process",
      data: { uploadId: row.id, workspaceId },
    });
  } catch (err) {
    console.error(
      "[uploads/complete] inngest.send failed:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json({ uploadId: row.id }, { status: 201 });
}
