"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DoNotContactToggle({
  customerId,
  value,
}: {
  customerId: string;
  value: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function toggle() {
    setSubmitting(true);
    await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ do_not_contact: !value }),
    });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Button variant={value ? "default" : "outline"} onClick={toggle} disabled={submitting}>
      {value ? "Remove do-not-contact" : "Mark do not contact"}
    </Button>
  );
}

export function AddNoteForm({
  customerId,
  workspaceId,
}: {
  customerId: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    const res = await fetch(`/api/customers/${customerId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: trimmed, workspaceId }),
    });
    if (res.ok) {
      setBody("");
      startTransition(() => router.refresh());
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note — follow-up, phone call outcome, job site detail…"
        rows={3}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending || body.trim().length === 0}>
          {isPending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
    router.push("/app/customers");
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Delete customer…
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-destructive">
        This is permanent. Are you sure?
      </span>
      <Button variant="destructive" onClick={confirm} disabled={submitting}>
        {submitting ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
