import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  History,
  Mail,
  MapPin,
  PhoneOff,
  RotateCcw,
  Users2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditRunnerButton } from "@/components/app/audit-runner-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveWorkspaceContext } from "@/lib/workspaces/active";

export const metadata: Metadata = { title: "Audit" };

type ReportJson = {
  totalCustomers?: number;
  completeCustomers?: number;
  missingPhone?: number;
  missingEmail?: number;
  missingAddress?: number;
  invalidPhones?: number;
  invalidEmails?: number;
  invalidAddresses?: number;
  duplicatesDetected?: number;
  inactiveOver12Months?: number;
  inactiveOver5Years?: number;
  reactivationCandidates?: { over12Months?: number; over5Years?: number };
};

export default async function AuditPage() {
  const ctx = await getActiveWorkspaceContext();
  const supabase = await createSupabaseServerClient();

  const { data: latest } = await supabase
    .from("audits")
    .select(
      "id, run_at, total_customers, complete_customers, missing_phone, missing_email, missing_address, invalid_phones, invalid_emails, invalid_addresses, duplicates_detected, inactive_over_12_months, inactive_over_5_years, report_json",
    )
    .eq("workspace_id", ctx.workspace.id)
    .order("run_at", { ascending: false })
    .limit(20);

  const audits = latest ?? [];
  const head = audits[0];

  const completePercent =
    head && head.total_customers > 0
      ? Math.round((head.complete_customers / head.total_customers) * 100)
      : null;

  const reactivation = (head?.report_json as ReportJson | null)?.reactivationCandidates ?? {
    over12Months: head ? Math.max(0, head.inactive_over_12_months - head.inactive_over_5_years) : 0,
    over5Years: head?.inactive_over_5_years ?? 0,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Audit
          </p>
          <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
            How healthy is your customer database?
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            One click to take the temperature of every record: what's missing,
            what's invalid, who's worth reaching out to.
          </p>
        </div>
        <AuditRunnerButton workspaceId={ctx.workspace.id} />
      </header>

      {!head ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-16 text-center">
          <p className="font-medium text-foreground">No audits yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Click <strong>Run audit now</strong> above to compute health
            metrics across your workspace.
          </p>
        </div>
      ) : (
        <>
          <p className="font-serif text-2xl leading-snug text-foreground">
            Of your {head.total_customers.toLocaleString()} customer
            {head.total_customers === 1 ? "" : "s"},{" "}
            <span className="text-accent">
              {head.complete_customers.toLocaleString()}
            </span>{" "}
            ({completePercent}%) have complete critical information.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Last run {new Date(head.run_at).toLocaleString()}
          </p>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              What's missing
            </h2>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <MetricCard
                icon={PhoneOff}
                label="Missing phone"
                value={head.missing_phone}
                href={`/app/customers?needs=phone`}
              />
              <MetricCard
                icon={Mail}
                label="Missing email"
                value={head.missing_email}
                href={`/app/customers?needs=email`}
              />
              <MetricCard
                icon={MapPin}
                label="Missing address"
                value={head.missing_address}
                href={`/app/customers?needs=address`}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Validation issues
            </h2>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <MetricCard
                icon={AlertTriangle}
                label="Invalid phones"
                value={head.invalid_phones}
                tone="warn"
              />
              <MetricCard
                icon={AlertTriangle}
                label="Bounced emails"
                value={head.invalid_emails}
                tone="warn"
              />
              <MetricCard
                icon={AlertTriangle}
                label="Undeliverable addresses"
                value={head.invalid_addresses}
                tone="warn"
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Cleanup queue
            </h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <MetricCard
                icon={Users2}
                label="Pending duplicate reviews"
                value={head.duplicates_detected}
                hint="Pairs we suspect are the same customer."
                href={`/app/customers?dnc=hide`}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Reactivation opportunity
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Customers you haven't talked to in a while. The five-year column
              is the most valuable phone-call list you'll ever build.
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <MetricCard
                icon={RotateCcw}
                label="No activity in 12+ months"
                value={reactivation.over12Months ?? 0}
                tone="accent"
                href="/app/customers?inactive=12mo"
              />
              <MetricCard
                icon={RotateCcw}
                label="No activity in 5+ years"
                value={reactivation.over5Years ?? 0}
                tone="accent"
                href="/app/customers?inactive=5y"
              />
            </div>
          </section>

          {audits.length > 1 && (
            <section className="mt-12">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                <History className="h-3 w-3" /> History
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card text-sm">
                {audits.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="text-foreground">
                      {new Date(a.run_at).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {a.complete_customers}/{a.total_customers} complete ·{" "}
                      {a.invalid_phones + a.invalid_emails + a.invalid_addresses} validation issues ·{" "}
                      {a.duplicates_detected} dup{a.duplicates_detected === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  hint?: string;
  href?: string;
  tone?: "neutral" | "warn" | "accent";
}) {
  const iconBg =
    tone === "warn"
      ? "bg-confidence-mid/15 text-[hsl(var(--confidence-mid))]"
      : tone === "accent"
        ? "bg-accent/15 text-accent"
        : "bg-secondary text-foreground";

  const inner = (
    <Card className={href ? "transition-colors hover:border-accent/60" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${iconBg}`}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-4xl text-foreground">{value.toLocaleString()}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}
