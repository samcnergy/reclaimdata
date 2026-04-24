"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  STORAGE_BUCKET,
  buildStoragePath,
} from "@/lib/storage/upload";
import { cn } from "@/lib/utils";

type Attempt = {
  id: string;
  file: File;
  status: "uploading" | "completed" | "failed";
  error?: string;
};

export function UploadDropzone({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const supabase = createSupabaseBrowserClient();

      const fileArr = Array.from(files);
      const validated = fileArr.map((f): Attempt => {
        if (f.size > MAX_UPLOAD_BYTES) {
          return {
            id: crypto.randomUUID(),
            file: f,
            status: "failed",
            error: "File exceeds 100 MB",
          };
        }
        if (f.type && !ACCEPTED_MIME_TYPES.has(f.type)) {
          return {
            id: crypto.randomUUID(),
            file: f,
            status: "failed",
            error: `Unsupported type: ${f.type}`,
          };
        }
        return { id: crypto.randomUUID(), file: f, status: "uploading" };
      });

      setAttempts((prev) => [...validated, ...prev]);

      await Promise.all(
        validated.map(async (attempt) => {
          if (attempt.status === "failed") return;

          const storagePath = buildStoragePath(
            workspaceId,
            attempt.id,
            attempt.file.name,
          );

          const { error: uploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, attempt.file, {
              upsert: false,
              contentType: attempt.file.type || "application/octet-stream",
            });

          if (uploadErr) {
            setAttempts((prev) =>
              prev.map((a) =>
                a.id === attempt.id
                  ? { ...a, status: "failed", error: uploadErr.message }
                  : a,
              ),
            );
            return;
          }

          const res = await fetch("/api/uploads/complete", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              storagePath,
              filename: attempt.file.name,
              mimeType: attempt.file.type || "application/octet-stream",
              sizeBytes: attempt.file.size,
            }),
          });

          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            setAttempts((prev) =>
              prev.map((a) =>
                a.id === attempt.id
                  ? {
                      ...a,
                      status: "failed",
                      error: data.error ?? "Upload record failed",
                    }
                  : a,
              ),
            );
            return;
          }

          setAttempts((prev) =>
            prev.map((a) =>
              a.id === attempt.id ? { ...a, status: "completed" } : a,
            ),
          );
        }),
      );

      router.refresh();
    },
    [workspaceId, router],
  );

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-card px-6 py-14 text-center transition-colors",
          isDragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/60 hover:bg-accent/5",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-accent">
          <FileUp className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-base font-medium text-foreground">
            Drop files here, or click to pick
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            PDFs, Word docs, Excel sheets, images. Up to 100 MB each.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
        >
          Browse files
        </Button>
      </label>

      {attempts.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {attempts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              {a.status === "uploading" && (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  strokeWidth={2}
                />
              )}
              {a.status === "completed" && (
                <CheckCircle2
                  className="h-4 w-4 text-confidence-high"
                  strokeWidth={2}
                />
              )}
              {a.status === "failed" && (
                <AlertTriangle
                  className="h-4 w-4 text-destructive"
                  strokeWidth={2}
                />
              )}
              <div className="flex-1">
                <p className="truncate font-medium text-foreground">
                  {a.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(a.file.size / 1024).toFixed(0)} KB
                  {a.error ? ` · ${a.error}` : ""}
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
