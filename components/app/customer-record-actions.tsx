"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ---------- shared dialog wrapper ----------------------------------- */

function EditDialog({
  trigger,
  title,
  open,
  setOpen,
  onSubmit,
  children,
  submitLabel = "Save",
}: {
  trigger: ReactNode;
  title: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: () => Promise<void>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => startTransition(() => submit(e))} className="space-y-4">
          {children}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- shared actions API --------------------------------------- */

async function patch(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
}

async function del(path: string): Promise<void> {
  const res = await fetch(path, { method: "DELETE" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
}

function useRefresh() {
  const router = useRouter();
  return () => router.refresh();
}

/* ---------- customer name + company ---------------------------------- */

export function EditCustomerNameButton({
  customerId,
  initialName,
  initialCompany,
}: {
  customerId: string;
  initialName: string;
  initialCompany: string | null;
}) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [company, setCompany] = useState(initialCompany ?? "");
  return (
    <EditDialog
      trigger={<IconTriggerButton onClick={() => setOpen(true)} icon={Pencil} label="Edit name" />}
      title="Edit name & company"
      open={open}
      setOpen={setOpen}
      onSubmit={async () => {
        await patch(`/api/customers/${customerId}`, {
          name: name.trim(),
          company_name: company.trim() || null,
        });
        refresh();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="ed-name">Name</Label>
        <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ed-company">Company (optional)</Label>
        <Input id="ed-company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
    </EditDialog>
  );
}

/* ---------- phones ---------------------------------------------------- */

export function PhoneRowActions({
  phoneId,
  rawValue,
  isPrimary,
}: {
  phoneId: string;
  rawValue: string;
  isPrimary: boolean;
}) {
  const refresh = useRefresh();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [value, setValue] = useState(rawValue);

  async function setPrimary() {
    await patch(`/api/phones/${phoneId}`, { isPrimary: true });
    refresh();
  }
  async function remove() {
    await del(`/api/phones/${phoneId}`);
    refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {!isPrimary && (
        <Button variant="ghost" size="sm" onClick={setPrimary} title="Mark as primary">
          Star
        </Button>
      )}
      <EditDialog
        trigger={<IconTriggerButton onClick={() => setEditOpen(true)} icon={Pencil} label="Edit phone" />}
        title="Edit phone"
        open={editOpen}
        setOpen={setEditOpen}
        onSubmit={async () => {
          await patch(`/api/phones/${phoneId}`, { rawValue: value.trim() });
          refresh();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="phone-edit">Phone number</Label>
          <Input id="phone-edit" value={value} onChange={(e) => setValue(e.target.value)} required />
          <p className="text-xs text-muted-foreground">
            Saving re-validates against Twilio on the next build run.
          </p>
        </div>
      </EditDialog>
      <ConfirmDelete
        open={confirmDel}
        setOpen={setConfirmDel}
        onConfirm={remove}
        label={`Delete phone ${rawValue}?`}
      />
    </div>
  );
}

export function AddPhoneButton({
  customerId,
  workspaceId,
}: {
  customerId: string;
  workspaceId: string;
}) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <EditDialog
      trigger={<TextTriggerButton onClick={() => setOpen(true)} label="Add phone" />}
      title="Add a phone number"
      open={open}
      setOpen={setOpen}
      onSubmit={async () => {
        await post(`/api/customers/${customerId}/phones`, {
          workspaceId,
          rawValue: value.trim(),
        });
        setValue("");
        refresh();
      }}
      submitLabel="Add"
    >
      <div className="space-y-2">
        <Label htmlFor="phone-add">Phone number</Label>
        <Input
          id="phone-add"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="(555) 555-1212"
          required
        />
      </div>
    </EditDialog>
  );
}

/* ---------- emails ---------------------------------------------------- */

export function EmailRowActions({
  emailId,
  rawValue,
  isPrimary,
}: {
  emailId: string;
  rawValue: string;
  isPrimary: boolean;
}) {
  const refresh = useRefresh();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [value, setValue] = useState(rawValue);

  async function setPrimary() {
    await patch(`/api/emails/${emailId}`, { isPrimary: true });
    refresh();
  }
  async function remove() {
    await del(`/api/emails/${emailId}`);
    refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {!isPrimary && (
        <Button variant="ghost" size="sm" onClick={setPrimary} title="Mark as primary">
          Star
        </Button>
      )}
      <EditDialog
        trigger={<IconTriggerButton onClick={() => setEditOpen(true)} icon={Pencil} label="Edit email" />}
        title="Edit email"
        open={editOpen}
        setOpen={setEditOpen}
        onSubmit={async () => {
          await patch(`/api/emails/${emailId}`, { rawValue: value.trim() });
          refresh();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email-edit">Email address</Label>
          <Input id="email-edit" type="email" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
      </EditDialog>
      <ConfirmDelete
        open={confirmDel}
        setOpen={setConfirmDel}
        onConfirm={remove}
        label={`Delete email ${rawValue}?`}
      />
    </div>
  );
}

export function AddEmailButton({
  customerId,
  workspaceId,
}: {
  customerId: string;
  workspaceId: string;
}) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <EditDialog
      trigger={<TextTriggerButton onClick={() => setOpen(true)} label="Add email" />}
      title="Add an email address"
      open={open}
      setOpen={setOpen}
      onSubmit={async () => {
        await post(`/api/customers/${customerId}/emails`, {
          workspaceId,
          rawValue: value.trim(),
        });
        setValue("");
        refresh();
      }}
      submitLabel="Add"
    >
      <div className="space-y-2">
        <Label htmlFor="email-add">Email address</Label>
        <Input
          id="email-add"
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </div>
    </EditDialog>
  );
}

/* ---------- addresses ------------------------------------------------- */

type AddressFields = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export function AddressRowActions({
  addressId,
  initial,
  isPrimary,
}: {
  addressId: string;
  initial: AddressFields;
  isPrimary: boolean;
}) {
  const refresh = useRefresh();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [fields, setFields] = useState<AddressFields>(initial);

  async function setPrimary() {
    await patch(`/api/addresses/${addressId}`, { isPrimary: true });
    refresh();
  }
  async function remove() {
    await del(`/api/addresses/${addressId}`);
    refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {!isPrimary && (
        <Button variant="ghost" size="sm" onClick={setPrimary} title="Mark as primary">
          Star
        </Button>
      )}
      <EditDialog
        trigger={<IconTriggerButton onClick={() => setEditOpen(true)} icon={Pencil} label="Edit address" />}
        title="Edit address"
        open={editOpen}
        setOpen={setEditOpen}
        onSubmit={async () => {
          await patch(`/api/addresses/${addressId}`, {
            line1: fields.line1?.trim() || null,
            line2: fields.line2?.trim() || null,
            city: fields.city?.trim() || null,
            state: fields.state?.trim().toUpperCase() || null,
            postalCode: fields.postalCode?.trim() || null,
          });
          refresh();
        }}
      >
        <AddressFieldset fields={fields} setFields={setFields} idPrefix="addr-edit" />
      </EditDialog>
      <ConfirmDelete
        open={confirmDel}
        setOpen={setConfirmDel}
        onConfirm={remove}
        label="Delete this address?"
      />
    </div>
  );
}

export function AddAddressButton({
  customerId,
  workspaceId,
}: {
  customerId: string;
  workspaceId: string;
}) {
  const refresh = useRefresh();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<AddressFields>({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
  });
  return (
    <EditDialog
      trigger={<TextTriggerButton onClick={() => setOpen(true)} label="Add address" />}
      title="Add an address"
      open={open}
      setOpen={setOpen}
      onSubmit={async () => {
        if (!fields.line1?.trim()) {
          throw new Error("Street address is required.");
        }
        await post(`/api/customers/${customerId}/addresses`, {
          workspaceId,
          line1: fields.line1.trim(),
          line2: fields.line2?.trim() || null,
          city: fields.city?.trim() || null,
          state: fields.state?.trim().toUpperCase() || null,
          postalCode: fields.postalCode?.trim() || null,
        });
        setFields({ line1: "", line2: "", city: "", state: "", postalCode: "" });
        refresh();
      }}
      submitLabel="Add"
    >
      <AddressFieldset fields={fields} setFields={setFields} idPrefix="addr-add" />
    </EditDialog>
  );
}

function AddressFieldset({
  fields,
  setFields,
  idPrefix,
}: {
  fields: AddressFields;
  setFields: (v: AddressFields) => void;
  idPrefix: string;
}) {
  const update = (k: keyof AddressFields, v: string) =>
    setFields({ ...fields, [k]: v });
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-line1`}>Street address</Label>
        <Input
          id={`${idPrefix}-line1`}
          value={fields.line1 ?? ""}
          onChange={(e) => update("line1", e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-line2`}>Apt / Suite (optional)</Label>
        <Input
          id={`${idPrefix}-line2`}
          value={fields.line2 ?? ""}
          onChange={(e) => update("line2", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            value={fields.city ?? ""}
            onChange={(e) => update("city", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-state`}>State</Label>
          <Input
            id={`${idPrefix}-state`}
            maxLength={2}
            value={fields.state ?? ""}
            onChange={(e) => update("state", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-zip`}>ZIP / Postal code</Label>
        <Input
          id={`${idPrefix}-zip`}
          value={fields.postalCode ?? ""}
          onChange={(e) => update("postalCode", e.target.value)}
        />
      </div>
    </>
  );
}

/* ---------- contracts ------------------------------------------------- */

type ContractFields = {
  contractDate: string;
  amountDollars: string;
  scopeOfWork: string;
};

function dollarsFromCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}
function centsFromDollars(dollars: string): number | null {
  const n = parseFloat(dollars.replace(/,/g, "").trim());
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function ContractRowActions({
  contractId,
  initial,
}: {
  contractId: string;
  initial: { contractDate: string | null; amountCents: number | null; scopeOfWork: string | null };
}) {
  const refresh = useRefresh();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [fields, setFields] = useState<ContractFields>({
    contractDate: initial.contractDate ?? "",
    amountDollars: dollarsFromCents(initial.amountCents),
    scopeOfWork: initial.scopeOfWork ?? "",
  });

  async function remove() {
    await del(`/api/contracts/${contractId}`);
    refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <EditDialog
        trigger={<IconTriggerButton onClick={() => setEditOpen(true)} icon={Pencil} label="Edit contract" />}
        title="Edit contract"
        open={editOpen}
        setOpen={setEditOpen}
        onSubmit={async () => {
          await patch(`/api/contracts/${contractId}`, {
            contractDate: fields.contractDate.trim() || null,
            amountCents: fields.amountDollars.trim()
              ? centsFromDollars(fields.amountDollars)
              : null,
            scopeOfWork: fields.scopeOfWork.trim() || null,
          });
          refresh();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ct-date">Date</Label>
            <Input
              id="ct-date"
              type="date"
              value={fields.contractDate}
              onChange={(e) => setFields({ ...fields, contractDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-amount">Amount ($)</Label>
            <Input
              id="ct-amount"
              type="text"
              inputMode="decimal"
              value={fields.amountDollars}
              onChange={(e) => setFields({ ...fields, amountDollars: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ct-scope">Scope of work</Label>
          <Textarea
            id="ct-scope"
            value={fields.scopeOfWork}
            onChange={(e) => setFields({ ...fields, scopeOfWork: e.target.value })}
            rows={4}
          />
        </div>
      </EditDialog>
      <ConfirmDelete
        open={confirmDel}
        setOpen={setConfirmDel}
        onConfirm={remove}
        label="Delete this contract?"
      />
    </div>
  );
}

/* ---------- shared bits ---------------------------------------------- */

function IconTriggerButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: typeof Pencil;
  label: string;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} aria-label={label} title={label}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
    </Button>
  );
}

function TextTriggerButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </Button>
  );
}

function ConfirmDelete({
  open,
  setOpen,
  onConfirm,
  label,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onConfirm: () => Promise<void>;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Delete"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is permanent. Customers and contracts that no longer have any
            data attached will be cleaned up automatically.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
              disabled={isPending}
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
