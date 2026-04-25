import Link from "next/link";
import type { Metadata } from "next";

import { BuildListButton } from "@/components/app/build-list-button";
import { UploadDropzone } from "@/components/app/upload-dropzone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveWorkspaceContext } from "@/lib/workspaces/active";

export const metadata: Metadata = {
  title: "Upload",
};

const statusLabels = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
} as const;

const statusTone = {
  queued: "bg-muted text-muted-foreground",
  processing: "bg-accent/15 text-accent",
  completed: "bg-confidence-high/15 text-confidence-high",
  failed: "bg-destructive/15 text-destructive",
} as const;

export default async function UploadPage() {
  const ctx = await getActiveWorkspaceContext();

  const supabase = await createSupabaseServerClient();
  const { data: uploads } = await supabase
    .from("uploads")
    .select("id, filename, mime_type, size_bytes, status, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(20);

  const canBuild = (uploads?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Upload
        </p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
          Turn your paper into a customer database.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Drop in contracts, invoices, scanned PDFs, Word docs, spreadsheets,
          and photographs. Everything stays inside your workspace — we process
          it on your behalf and never share it.
        </p>
      </header>

      <section>
        <UploadDropzone workspaceId={ctx.workspace.id} />
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-2xl text-foreground">Recent uploads</h2>
          <Link
            href="/app/uploads"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            View all
          </Link>
        </div>
        {uploads && uploads.length > 0 ? (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {uploads.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {u.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(u.size_bytes / 1024).toFixed(0)} KB ·{" "}
                    {new Date(u.uploaded_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusTone[u.status as keyof typeof statusTone]
                  }`}
                >
                  {statusLabels[u.status as keyof typeof statusLabels]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing uploaded yet.
          </p>
        )}
      </section>

      <section className="sticky bottom-4 mt-12 rounded-xl border border-accent/40 bg-card px-6 py-4 shadow-sm">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">
              Ready to build your client list?
            </p>
            <p className="text-sm text-muted-foreground">
              We'll extract customers, normalize phones and addresses, and flag
              duplicates.
            </p>
          </div>
          <BuildListButton workspaceId={ctx.workspace.id} disabled={!canBuild} />
        </div>
      </section>
    </div>
  );
}
