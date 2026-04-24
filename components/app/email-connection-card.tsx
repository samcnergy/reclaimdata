"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Connection = {
  id: string;
  email_address: string;
  last_sync_at: string | null;
};

export function EmailConnectionCard({
  workspaceId,
  connection,
}: {
  workspaceId: string;
  connection: Connection | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);

  if (!connection) {
    const href = `/api/email/connect?workspaceId=${workspaceId}`;
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Mail className="h-4 w-4 text-accent" strokeWidth={1.75} />
            Gmail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We read contact info from your sent folder only. We never send
            email, and we never store full message bodies beyond what's
            needed for extraction.
          </p>
          <Button asChild variant="outline" className="w-full">
            <a href={href}>Connect Gmail</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  async function sync() {
    setBusy("sync");
    await fetch("/api/email/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId: connection!.id }),
    });
    setBusy(null);
    router.refresh();
  }

  async function disconnect() {
    setBusy("disconnect");
    await fetch("/api/email/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId: connection!.id }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Mail className="h-4 w-4 text-confidence-high" strokeWidth={1.75} />
          Gmail connected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          <strong className="font-medium text-foreground">
            {connection.email_address}
          </strong>
          <br />
          Last sync:{" "}
          {connection.last_sync_at
            ? new Date(connection.last_sync_at).toLocaleString()
            : "never"}
        </p>
        <div className="flex gap-2">
          <Button onClick={sync} disabled={busy !== null} variant="accent" className="flex-1">
            {busy === "sync" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Syncing…
              </>
            ) : (
              "Sync now"
            )}
          </Button>
          <Button onClick={disconnect} disabled={busy !== null} variant="outline">
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
