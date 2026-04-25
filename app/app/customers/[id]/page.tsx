import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/app/confidence-badge";
import { HealthScore } from "@/components/app/health-score";
import { SourceLink } from "@/components/app/source-link";
import { ValidationPill } from "@/components/app/validation-pill";
import {
  AddNoteForm,
  DeleteCustomerButton,
  DoNotContactToggle,
} from "@/components/app/customer-actions";
import {
  AddAddressButton,
  AddEmailButton,
  AddPhoneButton,
  AddressRowActions,
  ContractRowActions,
  EditCustomerNameButton,
  EmailRowActions,
  PhoneRowActions,
} from "@/components/app/customer-record-actions";
import { getCustomerDetail } from "@/lib/customers/queries";
import { getActiveWorkspaceContext } from "@/lib/workspaces/active";

export const metadata: Metadata = { title: "Customer" };

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getActiveWorkspaceContext();
  const customer = await getCustomerDetail(ctx.workspace.id, id);
  if (!customer) notFound();

  const displayName = [customer.name_prefix, customer.name, customer.name_suffix]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <Link
        href="/app/customers"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeft className="h-3 w-3" />
        All customers
      </Link>

      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-4xl font-medium text-foreground">
              {displayName}
            </h1>
            <EditCustomerNameButton
              customerId={customer.id}
              initialName={customer.name}
              initialCompany={customer.company_name}
            />
          </div>
          {customer.company_name && (
            <p className="mt-1 text-lg text-muted-foreground">
              {customer.company_name}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex items-center gap-1">
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Health
              </span>
              <HealthScore score={customer.health_score} />
            </div>
            <div className="inline-flex items-center gap-1">
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Confidence
              </span>
              <ConfidenceBadge score={customer.confidence_score} />
            </div>
            {customer.last_contract_date && (
              <div>
                <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Last contract
                </span>{" "}
                <span className="text-foreground">{customer.last_contract_date}</span>
              </div>
            )}
            {customer.total_contract_value !== null && (
              <div>
                <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Lifetime
                </span>{" "}
                <span className="text-foreground">{formatCents(customer.total_contract_value)}</span>
              </div>
            )}
            {customer.do_not_contact && <Badge tone="bad">Do not contact</Badge>}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Phones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.phones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phones on file.</p>
            ) : (
              <ul className="space-y-3">
                {customer.phones.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {p.e164_value ?? p.raw_value}
                        {p.id === customer.primary_phone_id && (
                          <Badge tone="accent" className="ml-2">Primary</Badge>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {p.line_type && <span className="capitalize">{p.line_type}</span>}
                        {p.carrier && <span>· {p.carrier}</span>}
                        <ConfidenceBadge score={p.confidence} />
                        <SourceLink refs={p.source_refs ?? []} />
                      </p>
                    </div>
                    <ValidationPill kind="phone" status={p.validation_status} />
                    <PhoneRowActions
                      phoneId={p.id}
                      rawValue={p.raw_value}
                      isPrimary={p.id === customer.primary_phone_id}
                    />
                  </li>
                ))}
              </ul>
            )}
            <AddPhoneButton customerId={customer.id} workspaceId={ctx.workspace.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No emails on file.</p>
            ) : (
              <ul className="space-y-3">
                {customer.emails.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {e.normalized_value ?? e.raw_value}
                        {e.id === customer.primary_email_id && (
                          <Badge tone="accent" className="ml-2">Primary</Badge>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <ConfidenceBadge score={e.confidence} />
                        <SourceLink refs={e.source_refs ?? []} />
                      </p>
                    </div>
                    <ValidationPill kind="email" status={e.validation_status} />
                    <EmailRowActions
                      emailId={e.id}
                      rawValue={e.raw_value}
                      isPrimary={e.id === customer.primary_email_id}
                    />
                  </li>
                ))}
              </ul>
            )}
            <AddEmailButton customerId={customer.id} workspaceId={ctx.workspace.id} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No addresses on file.</p>
            ) : (
              <ul className="space-y-4">
                {customer.addresses.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {[a.line1, a.line2].filter(Boolean).join(" ")}
                        {a.id === customer.primary_address_id && (
                          <Badge tone="accent" className="ml-2">Primary</Badge>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {[a.city, a.state, a.postal_code].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <ConfidenceBadge score={a.confidence} />
                        <SourceLink refs={a.source_refs ?? []} />
                      </p>
                    </div>
                    <ValidationPill kind="address" status={a.validation_status} />
                    <AddressRowActions
                      addressId={a.id}
                      isPrimary={a.id === customer.primary_address_id}
                      initial={{
                        line1: a.line1,
                        line2: a.line2,
                        city: a.city,
                        state: a.state,
                        postalCode: a.postal_code,
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <AddAddressButton customerId={customer.id} workspaceId={ctx.workspace.id} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contracts extracted yet.</p>
            ) : (
              <ul className="space-y-4">
                {customer.contracts.map((c) => (
                  <li key={c.id} className="rounded-md border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium text-foreground">
                          {c.contract_date ?? "Date unknown"}
                          <span className="ml-3 text-muted-foreground">
                            {formatCents(c.amount_cents)}
                          </span>
                        </p>
                        {c.scope_of_work && (
                          <p className="mt-1 text-sm text-foreground">{c.scope_of_work}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <ConfidenceBadge score={c.confidence} />
                        <SourceLink refs={c.source_refs ?? []} />
                        <ContractRowActions
                          contractId={c.id}
                          initial={{
                            contractDate: c.contract_date,
                            amountCents: c.amount_cents,
                            scopeOfWork: c.scope_of_work,
                          }}
                        />
                      </div>
                    </div>
                    {c.line_items.length > 0 && (
                      <ul className="mt-3 divide-y divide-border border-t border-border pt-3 text-xs text-muted-foreground">
                        {c.line_items.map((li) => (
                          <li key={li.id} className="flex items-center justify-between py-1.5">
                            <span className="text-foreground">
                              {[li.product_type, li.size, li.color].filter(Boolean).join(" · ") ||
                                "Line item"}
                            </span>
                            <span className="tabular-nums">
                              {li.quantity ?? ""}
                              {li.unit_price_cents !== null
                                ? ` @ ${formatCents(li.unit_price_cents)}`
                                : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AddNoteForm customerId={customer.id} workspaceId={ctx.workspace.id} />
            {customer.notes.length > 0 && (
              <ul className="space-y-4">
                {customer.notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border bg-background p-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {n.author_email} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-destructive/30">
          <CardHeader>
            <CardTitle>Contact preferences</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <DoNotContactToggle
              customerId={customer.id}
              value={customer.do_not_contact}
            />
            <DeleteCustomerButton customerId={customer.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
