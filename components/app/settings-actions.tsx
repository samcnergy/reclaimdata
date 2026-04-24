"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WorkspaceNameForm({
  workspaceId,
  initial,
}: {
  workspaceId: string;
  initial: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-3">
      <div className="flex-1">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className="mt-2"
        />
      </div>
      <Button type="submit" disabled={submitting || name === initial}>
        {submitting ? "Saving…" : saved ? "Saved" : "Save"}
      </Button>
    </form>
  );
}

export function DeleteWorkspaceButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const res = await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setSubmitting(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Delete this workspace…
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm text-destructive">
        This permanently deletes every customer, contract, upload, and audit
        in this workspace. There is no undo. Type <strong>DELETE</strong> to
        confirm.
      </p>
      <div className="flex gap-2">
        <Input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="DELETE"
        />
        <Button
          variant="destructive"
          disabled={phrase !== "DELETE" || submitting}
          onClick={submit}
        >
          {submitting ? "Deleting…" : "Delete forever"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
