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
import { PLAN_DISPLAY } from "@/lib/billing/plans";
import { getActiveWorkspaceContext } from "@/lib/workspaces/active";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const ctx = await getActiveWorkspaceContext();
  const monthlyEnv = process.env.SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY;
  const planReady = Boolean(monthlyEnv);
  const onPaidPlan = ctx.workspace.plan === "professional";

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
          Current plan:{" "}
          <Badge tone="accent">{PLAN_DISPLAY[ctx.workspace.plan].name}</Badge>
        </p>
      </header>

      {!planReady && (
        <Card className="border-confidence-mid/40 bg-confidence-mid/5">
          <CardContent className="p-4 text-sm text-foreground">
            <strong className="font-medium">Setup pending:</strong> The Square
            plan ID isn't configured yet. Run{" "}
            <code className="rounded bg-card px-1 py-0.5 text-xs">
              npx tsx scripts/bootstrap-square-plans.ts
            </code>{" "}
            and paste the resulting ID into Render's environment as{" "}
            <code className="rounded bg-card px-1 py-0.5 text-xs">
              SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY
            </code>
            .
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4">
        <Card className={onPaidPlan ? "border-accent" : ""}>
          <CardHeader>
            <CardTitle>Reclaim Data</CardTitle>
            <CardDescription>
              $249 per month. Up to 2,500 customers, 1 user, unlimited
              uploads, CSV export, priority processing, and handwritten note
              support.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {onPaidPlan ? (
              <Badge tone="accent">Current plan</Badge>
            ) : (
              <Button
                variant="default"
                className="w-full"
                disabled={!monthlyEnv}
                asChild
              >
                <a
                  href={
                    monthlyEnv
                      ? `/api/square/checkout?workspaceId=${ctx.workspace.id}&planVariationId=${monthlyEnv}`
                      : "#"
                  }
                >
                  Subscribe — $249 / month
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Cancel</CardTitle>
          <CardDescription>
            Cancellation takes effect at the end of your current billing
            cycle. Square doesn't offer a hosted customer portal, so card
            updates and invoice downloads land in a follow-up release.
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
            and we'll handle cancellation within one business day.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
