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
import { PLAN_DISPLAY, type Plan } from "@/lib/billing/plans";
import { getActiveWorkspaceContext } from "@/lib/workspaces/active";

export const metadata: Metadata = { title: "Billing" };

type Tier = {
  plan: Plan;
  monthlyEnv: string | undefined;
  annualEnv: string | undefined;
};

const TIERS: Tier[] = [
  { plan: "starter", monthlyEnv: process.env.SQUARE_PLAN_ID_STARTER_MONTHLY, annualEnv: process.env.SQUARE_PLAN_ID_STARTER_ANNUAL },
  { plan: "professional", monthlyEnv: process.env.SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY, annualEnv: process.env.SQUARE_PLAN_ID_PROFESSIONAL_ANNUAL },
  { plan: "legacy", monthlyEnv: process.env.SQUARE_PLAN_ID_LEGACY_MONTHLY, annualEnv: process.env.SQUARE_PLAN_ID_LEGACY_ANNUAL },
];

export default async function BillingPage() {
  const ctx = await getActiveWorkspaceContext();
  const planReady = TIERS.every((t) => t.monthlyEnv && t.annualEnv);

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-10 space-y-8">
      <header>
        <Link
          href="/app/settings"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Settings
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-foreground">
          Billing
        </h1>
        <p className="mt-2 text-muted-foreground">
          Current plan: <Badge tone="accent">{PLAN_DISPLAY[ctx.workspace.plan].name}</Badge>
        </p>
      </header>

      {!planReady && (
        <Card className="border-confidence-mid/40 bg-confidence-mid/5">
          <CardContent className="p-4 text-sm text-foreground">
            <strong className="font-medium">Setup pending:</strong> Square plan
            IDs aren't configured yet. Run{" "}
            <code className="rounded bg-card px-1 py-0.5 text-xs">
              npx tsx scripts/bootstrap-square-plans.ts
            </code>{" "}
            and paste the resulting IDs into Render's environment.
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const meta = PLAN_DISPLAY[tier.plan];
          const current = ctx.workspace.plan === tier.plan;
          return (
            <Card key={tier.plan} className={current ? "border-accent" : ""}>
              <CardHeader>
                <CardTitle>{meta.name}</CardTitle>
                <CardDescription>{meta.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {current ? (
                  <Badge tone="accent">Current plan</Badge>
                ) : (
                  <>
                    <Button
                      variant="default"
                      className="w-full"
                      disabled={!tier.monthlyEnv}
                      asChild
                    >
                      <a
                        href={
                          tier.monthlyEnv
                            ? `/api/square/checkout?workspaceId=${ctx.workspace.id}&planVariationId=${tier.monthlyEnv}`
                            : "#"
                        }
                      >
                        Choose monthly
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!tier.annualEnv}
                      asChild
                    >
                      <a
                        href={
                          tier.annualEnv
                            ? `/api/square/checkout?workspaceId=${ctx.workspace.id}&planVariationId=${tier.annualEnv}`
                            : "#"
                        }
                      >
                        Choose annual
                      </a>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Cancel or change plan</CardTitle>
          <CardDescription>
            Changes take effect at the end of your current billing cycle.
            Square doesn't offer a hosted customer portal, so card updates +
            invoice downloads land in a follow-up release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            For now, contact{" "}
            <a
              href="mailto:hello@reclaimdata.ai"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              hello@reclaimdata.ai
            </a>{" "}
            and we'll handle plan changes within one business day.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
