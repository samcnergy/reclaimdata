import Link from "next/link";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DeleteWorkspaceButton,
  WorkspaceNameForm,
} from "@/components/app/settings-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveWorkspaceContext } from "@/lib/workspaces/active";
import { PLAN_DISPLAY, PLANS } from "@/lib/billing/plans";
import { getWorkspaceUsage } from "@/lib/billing/enforce";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getActiveWorkspaceContext();
  const supabase = await createSupabaseServerClient();

  const [{ data: members }, usage] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, joined_at, user_id")
      .eq("workspace_id", ctx.workspace.id),
    getWorkspaceUsage(ctx.workspace.id),
  ]);

  // Resolve member emails through public.users (no FK hint required).
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id, email, full_name").in("id", userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const planRules = PLANS[ctx.workspace.plan];
  const planMeta = PLAN_DISPLAY[ctx.workspace.plan];
  const exportEnabled = planRules.csvExport;

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>
        <h1 className="mt-2 font-serif text-4xl font-medium text-foreground">
          {ctx.workspace.name}
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceNameForm
            workspaceId={ctx.workspace.id}
            initial={ctx.workspace.name}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan & billing</CardTitle>
          <CardDescription>{planMeta.tagline}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={ctx.workspace.plan === "free" ? "muted" : "accent"}>
              {planMeta.name}
            </Badge>
            <Button asChild variant="outline">
              <Link href="/app/settings/billing">Manage billing</Link>
            </Button>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <UsageRow label="Customers" current={usage.customers} limit={planRules.customers} />
            <UsageRow label="Uploads" current={usage.uploads} limit={planRules.uploads} />
            <UsageRow label="Email connections" current={usage.emailConnections} limit={planRules.emailConnections} />
            <UsageRow label="Members" current={usage.users} limit={planRules.users} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Invite teammates from{" "}
            <Link href="/app/settings/billing" className="underline-offset-4 hover:underline">
              Manage billing
            </Link>{" "}
            once your plan supports more than one user. Invitation flow lands in a follow-up release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border rounded-md border border-border bg-card text-sm">
            {(members ?? []).map((m) => {
              const u = userMap.get(m.user_id);
              return (
                <li key={m.user_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {u?.full_name ?? u?.email ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{u?.email}</p>
                  </div>
                  <Badge tone="muted" className="capitalize">
                    {m.role}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data export</CardTitle>
          <CardDescription>
            One ZIP with seven CSVs: customers, phones, emails, addresses, contracts, line items, notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild disabled={!exportEnabled} variant={exportEnabled ? "default" : "outline"}>
            <a href={`/api/data-export?workspaceId=${ctx.workspace.id}`}>
              {exportEnabled ? "Download workspace export" : "Available on paid plans"}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Deleting the workspace is permanent. All customers, contracts,
            uploads, and audits go with it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteWorkspaceButton workspaceId={ctx.workspace.id} />
        </CardContent>
      </Card>
    </div>
  );
}

function UsageRow({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const text =
    limit === 0
      ? `${current.toLocaleString()} (unlimited)`
      : `${current.toLocaleString()} / ${limit.toLocaleString()}`;
  const tone = limit > 0 && current / limit > 0.8 ? "text-confidence-mid" : "text-foreground";

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 font-medium tabular-nums ${tone}`}>{text}</dd>
    </div>
  );
}
