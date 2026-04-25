"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteUploadButton({
  uploadId,
  filename,
}: {
  uploadId: string;
  filename: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    const res = await fetch(`/api/uploads/${uploadId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${filename}`}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this upload?</DialogTitle>
          <DialogDescription>
            <strong className="font-medium text-foreground">{filename}</strong>{" "}
            and its extracted response will be permanently removed from
            storage. Customers and contracts already created from this file
            stay in your workspace — delete those individually if you want a
            clean slate.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
              </>
            ) : (
              "Delete forever"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
