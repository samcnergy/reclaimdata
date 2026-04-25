import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/storage/upload";

/**
 * Hard-delete an upload + everything it produced. The DB cascade is
 * handled atomically by the `delete_upload_cascade` Postgres function
 * (migration 0003):
 *   - phones / emails / addresses / contracts that reference ONLY this
 *     upload → deleted outright
 *   - phones / emails / addresses / contracts referencing multiple
 *     uploads → just stripped of this upload from source_refs
 *   - customers that end up with zero remaining children → deleted
 *   - extraction_runs → cascades via FK
 *   - the uploads row itself
 *
 * Storage cleanup runs after the DB transaction succeeds: the original
 * file under {workspaceId}/{uploadId}-{filename} and the archived Claude
 * response under {workspaceId}/_extraction/{runId}.json.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: upload } = await supabase
    .from("uploads")
    .select("id, workspace_id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();

  // Capture extraction-archive paths before the cascade nukes the rows.
  const { data: runs } = await admin
    .from("extraction_runs")
    .select("raw_response_storage_path")
    .eq("upload_id", id);

  const storagePaths = [upload.storage_path];
  for (const r of runs ?? []) {
    if (r.raw_response_storage_path) storagePaths.push(r.raw_response_storage_path);
  }

  // Atomic DB cleanup via the cascade function.
  const { error: rpcErr } = await admin.rpc("delete_upload_cascade", {
    p_upload_id: id,
  });
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // Storage cleanup is best-effort. If a path is already gone the API
  // just no-ops on it.
  const { error: storageErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .remove(storagePaths);
  if (storageErr) {
    console.error(`[uploads/delete] storage cleanup partial: ${storageErr.message}`);
  }

  return NextResponse.json({
    ok: true,
    removedStorageObjects: storagePaths.length,
  });
}
