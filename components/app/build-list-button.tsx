"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BuildListButton({
  workspaceId,
  disabled,
}: {
  workspaceId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
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
        throw new Error(data.error ?? "Failed to start build");
      }
      setQueued(true);
      router.push("/app/customers");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  if (queued) {
    return (
      <Button variant="accent" size="lg" disabled>
        Building — check back in a minute
      </Button>
    );
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
            Queuing…
          </>
        ) : disabled ? (
          "Upload a file first"
        ) : (
          "Build my client list"
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
