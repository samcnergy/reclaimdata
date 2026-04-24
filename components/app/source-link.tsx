"use client";

import { useState } from "react";
import { Link2, ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SourceRef = { uploadId: string; kind?: string; page?: number };

/**
 * Click "Source" next to any extracted field → pops a modal listing the
 * original documents the field came from. Clicking an upload opens a
 * signed-URL download so the user can verify against the source.
 *
 * Full region-highlighting (the spec's trust-anchor feature) lands in
 * milestone 16; M12 ships the doc linkback without the per-page overlay.
 */
export function SourceLink({ refs }: { refs: SourceRef[] }) {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, { filename: string; url: string } | "loading" | "error">>({});

  async function load() {
    for (const ref of refs) {
      if (urls[ref.uploadId]) continue;
      setUrls((s) => ({ ...s, [ref.uploadId]: "loading" }));
      try {
        const res = await fetch(`/api/uploads/${ref.uploadId}/source`);
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = (await res.json()) as { filename: string; url: string };
        setUrls((s) => ({ ...s, [ref.uploadId]: data }));
      } catch {
        setUrls((s) => ({ ...s, [ref.uploadId]: "error" }));
      }
    }
  }

  if (refs.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          load();
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-accent hover:underline"
      >
        <Link2 className="h-3 w-3" strokeWidth={1.75} />
        Source
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Where this came from</DialogTitle>
          <DialogDescription>
            Every field links back to the document it was extracted from. Open
            the file to verify the value.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {refs.map((ref) => {
            const state = urls[ref.uploadId];
            return (
              <li
                key={ref.uploadId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  {state && state !== "loading" && state !== "error" ? (
                    <p className="truncate font-medium text-foreground">{state.filename}</p>
                  ) : (
                    <p className="truncate font-medium text-muted-foreground">Loading…</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {ref.kind ?? "extracted"}
                    {ref.page ? ` · page ${ref.page}` : ""}
                  </p>
                </div>
                {state && state !== "loading" && state !== "error" && (
                  <a
                    href={state.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                )}
                {state === "error" && (
                  <span className="text-xs text-destructive">Failed to load</span>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
