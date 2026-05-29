import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getActiveWorkspaceContext } from "@/lib/workspaces/active";
import { CheckoutForm } from "@/components/app/checkout-form";

export const metadata: Metadata = { title: "Subscribe" };

export default async function CheckoutPage() {
  const ctx = await getActiveWorkspaceContext();

  // Already subscribed — send straight to the app.
  if (ctx.workspace.plan !== "free") {
    redirect("/app");
  }

  const planVariationId = process.env.SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY;
  if (!planVariationId) {
    // Square not configured yet — fall back to billing settings page
    redirect("/app/settings/billing");
  }

  // These are NEXT_PUBLIC_* so they reach the client bundle. They're baked
  // in at BUILD time — setting them in Render after deploy isn't enough,
  // a rebuild is required for the new values to reach the browser.
  const squareAppId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ?? "";
  const squareLocationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ?? "";
  const squareEnv =
    process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";

  // Fail fast & visibly if the public env vars didn't make it into the
  // build. Otherwise the page renders a card form that throws "Could not
  // load the payment form" the moment the Square SDK initializes, with
  // no clue why for the operator.
  const missingPublicEnv: string[] = [];
  if (!squareAppId) missingPublicEnv.push("NEXT_PUBLIC_SQUARE_APPLICATION_ID");
  if (!squareLocationId) missingPublicEnv.push("NEXT_PUBLIC_SQUARE_LOCATION_ID");

  return (
    <div className="mx-auto w-full max-w-lg px-8 py-16 space-y-8">
      <header>
        <Link
          href="/app/settings/billing"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Billing
        </Link>
        <h1 className="mt-3 font-serif text-4xl font-medium text-foreground">
          Subscribe
        </h1>
        <p className="mt-2 text-muted-foreground">
          Reclaim Data — $249 / month. Cancel any time.
        </p>
      </header>

      {missingPublicEnv.length > 0 ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm">
          <p className="font-medium text-destructive">
            Payment provider isn't configured for this deployment.
          </p>
          <p className="mt-2 text-foreground">
            The following environment variables are missing from the build:
          </p>
          <ul className="mt-2 list-disc pl-5 font-mono text-xs text-foreground">
            {missingPublicEnv.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <p className="mt-3 text-muted-foreground">
            Set them in the hosting platform's environment, then trigger a
            full rebuild — these are baked into the client bundle at build
            time, so a runtime env change alone won't take effect.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Need help? Email{" "}
            <a
              className="font-medium text-foreground underline-offset-4 hover:underline"
              href="mailto:hello@reclaimdata.ai"
            >
              hello@reclaimdata.ai
            </a>
            .
          </p>
        </div>
      ) : (
        <CheckoutForm
          workspaceId={ctx.workspace.id}
          planVariationId={planVariationId}
          squareAppId={squareAppId}
          squareLocationId={squareLocationId}
          squareEnv={squareEnv as "sandbox" | "production"}
        />
      )}
    </div>
  );
}
