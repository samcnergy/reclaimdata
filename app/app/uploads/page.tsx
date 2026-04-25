import type { Metadata } from "next";

import { DeleteUploadButton } from "@/components/app/upload-row-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Upload history" };

const statusTone = {
  queued: "bg-muted text-muted-foreground",
  processing: "bg-accent/15 text-accent",
  completed: "bg-confidence-high/15 text-confidence-high",
  failed: "bg-destructive/15 text-destructive",
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function UploadsHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: uploads } = await supabase
    .from("uploads")
    .select("id, filename, mime_type, size_bytes, status, error_message, uploaded_at, processed_at")
    .order("uploaded_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Uploads
        </p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
          Ingestion log
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Every file you've uploaded, with its processing status and any
          errors. Nothing is ever deleted from your workspace automatically.
        </p>
      </header>

      {uploads && uploads.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td className="max-w-xs truncate px-4 py-3 font-medium text-foreground">
                    {u.filename}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.mime_type.split("/")[1] ?? u.mime_type}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatBytes(u.size_bytes)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.uploaded_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusTone[u.status as keyof typeof statusTone]
                      }`}
                    >
                      {u.status}
                    </span>
                    {u.error_message && (
                      <p className="mt-1 text-xs text-destructive">
                        {u.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <DeleteUploadButton uploadId={u.id} filename={u.filename} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing uploaded yet. Head to{" "}
          <a
            href="/app/upload"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Upload
          </a>{" "}
          to get started.
        </p>
      )}
    </div>
  );
}
