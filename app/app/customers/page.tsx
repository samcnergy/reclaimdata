import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfidenceBadge } from "@/components/app/confidence-badge";
import { HealthScore } from "@/components/app/health-score";
import {
  listCustomers,
  type CustomerListFilters,
} from "@/lib/customers/queries";
import { getActiveWorkspaceContext } from "@/lib/workspaces/active";

export const metadata: Metadata = { title: "Customers" };

type SearchParams = Record<string, string | string[] | undefined>;

function param(p: SearchParams, key: string): string | undefined {
  const v = p[key];
  return Array.isArray(v) ? v[0] : v;
}

function parseFilters(p: SearchParams): CustomerListFilters {
  const healthBucket = param(p, "health");
  let healthMin: number | undefined;
  let healthMax: number | undefined;
  if (healthBucket === "low") healthMax = 39;
  else if (healthBucket === "mid") {
    healthMin = 40;
    healthMax = 74;
  } else if (healthBucket === "high") healthMin = 75;

  return {
    q: param(p, "q"),
    healthMin,
    healthMax,
    needsPhone: param(p, "needs") === "phone",
    needsEmail: param(p, "needs") === "email",
    needsAddress: param(p, "needs") === "address",
    inactive12mo: param(p, "inactive") === "12mo",
    inactive5y: param(p, "inactive") === "5y",
    doNotContact: param(p, "dnc") === "only"
      ? "only"
      : param(p, "dnc") === "hide"
        ? "hide"
        : undefined,
    sort:
      (param(p, "sort") as CustomerListFilters["sort"] | undefined) ??
      "health-asc",
  };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const ctx = await getActiveWorkspaceContext();
  const filters = parseFilters(sp);

  const { rows, total } = await listCustomers(ctx.workspace.id, filters);

  const chipBase = "rounded-full border px-3 py-1 text-xs transition-colors";
  const activeChip = "border-accent bg-accent/10 text-accent";
  const inactiveChip = "border-border bg-card text-muted-foreground hover:border-accent/60";

  const chipLink = (
    key: string,
    value: string | undefined,
    label: string,
    currentValue?: string,
  ) => {
    const active = currentValue === value;
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === key) continue;
      if (typeof v === "string") next.set(k, v);
    }
    if (!active && value) next.set(key, value);
    const href = `?${next.toString()}`;
    return (
      <Link key={`${key}:${value ?? "clear"}`} href={href} className={`${chipBase} ${active ? activeChip : inactiveChip}`}>
        {label}
      </Link>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-8 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Customers
          </p>
          <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
            {total} customer{total === 1 ? "" : "s"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sorted by health score ascending — worst records first, so you
            know where to focus.
          </p>
        </div>
      </header>

      <form className="mb-4 flex gap-2">
        <Input
          name="q"
          defaultValue={param(sp, "q") ?? ""}
          placeholder="Search by name or company"
          className="max-w-md"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {param(sp, "q") && (
          <Link href="?" className="text-xs text-muted-foreground self-center underline-offset-4 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground mr-1">
          Health
        </span>
        {chipLink("health", "low", "Below 40", param(sp, "health"))}
        {chipLink("health", "mid", "40–75", param(sp, "health"))}
        {chipLink("health", "high", "75+", param(sp, "health"))}

        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground ml-3 mr-1">
          Needs
        </span>
        {chipLink("needs", "phone", "Phone", param(sp, "needs"))}
        {chipLink("needs", "email", "Email", param(sp, "needs"))}
        {chipLink("needs", "address", "Address", param(sp, "needs"))}

        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground ml-3 mr-1">
          Inactive
        </span>
        {chipLink("inactive", "12mo", "12+ months", param(sp, "inactive"))}
        {chipLink("inactive", "5y", "5+ years", param(sp, "inactive"))}

        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground ml-3 mr-1">
          Contact
        </span>
        {chipLink("dnc", "only", "Do not contact", param(sp, "dnc"))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-16 text-center">
          <p className="font-medium text-foreground">No customers yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Head to{" "}
            <Link href="/app/upload" className="underline-offset-4 hover:underline">
              Upload
            </Link>{" "}
            and drop your first files. Then click <strong>Build my client list</strong>.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Last contract</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/20">
                  <td className="max-w-xs px-4 py-3">
                    <Link
                      href={`/app/customers/${c.id}`}
                      className="font-medium text-foreground transition-colors hover:text-accent"
                    >
                      {c.name}
                    </Link>
                    {c.company_name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {c.company_name}
                      </p>
                    )}
                    {c.do_not_contact && (
                      <Badge tone="bad" className="mt-1">Do not contact</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{c.primary_phone ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground">{c.primary_email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.primary_city && c.primary_state
                      ? `${c.primary_city}, ${c.primary_state}`
                      : c.primary_city ?? c.primary_state ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.last_contract_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <HealthScore score={c.health_score} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidenceBadge score={c.confidence_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
