"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Stats = {
  uploadsExtracted: number;
  uploadsFailed: number;
  customersCreated: number;
  customersMerged: number;
  candidatesQueued: number;
  contractsCreated: number;
};

export function BuildListButton({
  workspaceId,
  disabled,
}: {
  workspaceId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/build-list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to build client list");
      }
      const { stats } = (await res.json()) as { stats: Stats };
      const total = stats.customersCreated + stats.customersMerged;
      const message =
        total > 0
          ? `Built — ${stats.customersCreated} new, ${stats.customersMerged} merged.`
          : `No customers extracted yet. Try uploading a contract or invoice.`;
      router.push(`/app/customers?built=${encodeURIComponent(message)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="accent"
        size="lg"
        onClick={run}
        disabled={disabled || submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            Reading your files…
          </>
        ) : disabled ? (
          "Upload a file first"
        ) : (
          "Build my client list"
        )}
      </Button>
      {submitting && (
        <p className="text-xs text-muted-foreground">
          Could take a minute per file. Don't close the tab.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
