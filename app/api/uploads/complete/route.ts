import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Called by the browser after a file has finished uploading directly to
 * Supabase Storage. Writes a row into `public.uploads` (RLS scopes by
 * workspace).
 *
 * Extraction runs lazily when the user clicks "Build my client list" —
 * see /api/build-list. Decoupling here keeps the upload UX snappy and
 * removes the dependency on an external job queue for v1.
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

  return NextResponse.json({ uploadId: row.id }, { status: 201 });
}
