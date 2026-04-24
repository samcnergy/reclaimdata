import Link from "next/link";
import type { Metadata } from "next";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Upload
        </p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
          Bring in your customer records.
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Drag in files, or connect an inbox. Everything here stays inside
          your workspace — we process it on your behalf and never share it.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="font-serif text-2xl text-foreground">Files</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Contracts, invoices, scanned PDFs, Word docs, spreadsheets, images.
          </p>
          <div className="mt-6">
            <UploadDropzone workspaceId={ctx.workspace.id} />
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-foreground">Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect Gmail and we'll pull customer contacts from your sent
            folder.
          </p>
          <Card className="mt-6 border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Mail className="h-4 w-4 text-accent" strokeWidth={1.75} />
                Gmail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                We read contact and contract info only. We never send email,
                and we never store full message bodies beyond what's needed
                for extraction.
              </p>
              <Button variant="outline" disabled className="w-full">
                Connect — coming in the next release
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>

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
          <Button variant="accent" size="lg" disabled={!canBuild}>
            {canBuild
              ? "Build my client list"
              : "Upload a file first"}
          </Button>
        </div>
      </section>
    </div>
  );
}
