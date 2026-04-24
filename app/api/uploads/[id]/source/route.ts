import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET } from "@/lib/storage/upload";

/**
 * Returns a signed download URL for an upload the user has access to.
 * RLS on `uploads` gates whether the SELECT returns anything; we also
 * generate the signed URL with a short (60 s) TTL so the link can't be
 * shared widely.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: upload } = await supabase
    .from("uploads")
    .select("filename, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(upload.storage_path, 60);

  if (error || !signed) {
    return NextResponse.json(
      { error: error?.message ?? "Sign failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ filename: upload.filename, url: signed.signedUrl });
}
