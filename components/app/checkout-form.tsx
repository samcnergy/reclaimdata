"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

// ─── Square Web Payments SDK ambient types ────────────────────────────────────

interface SquareCardInstance {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<{
    status: "OK" | "Error" | "Cancel";
    token?: string;
    errors?: Array<{ message: string }>;
  }>;
  destroy(): void;
}

interface SquarePayments {
  card(): Promise<SquareCardInstance>;
}

declare global {
  interface Window {
    Square?: {
      payments(appId: string, locationId: string): Promise<SquarePayments>;
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  workspaceId: string;
  planVariationId: string;
  squareAppId: string;
  squareLocationId: string;
  squareEnv: "sandbox" | "production";
}

export function CheckoutForm({
  workspaceId,
  planVariationId,
  squareAppId,
  squareLocationId,
  squareEnv,
}: Props) {
  const router = useRouter();
  const cardRef = useRef<SquareCardInstance | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the Square Web Payments SDK and attach the card form.
  useEffect(() => {
    const scriptSrc =
      squareEnv === "production"
        ? "https://web.squarecdn.com/v1/square.js"
        : "https://sandbox.web.squarecdn.com/v1/square.js";

    let script = document.getElementById(
      "square-web-sdk",
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = "square-web-sdk";
      script.src = scriptSrc;
      script.async = true;
      document.head.appendChild(script);
    }

    async function init() {
      // Stage 1: wait for the SDK script to load. A failure here is almost
      // always CSP (script-src missing *.squarecdn.com) or a network block
      // (corporate proxy / ad blocker / VPN). Surface the URL we tried.
      try {
        await new Promise<void>((resolve, reject) => {
          if (window.Square) {
            resolve();
            return;
          }
          script!.addEventListener("load", () => resolve());
          script!.addEventListener("error", () =>
            reject(new Error(`Square SDK script failed to load (${scriptSrc})`)),
          );
        });
      } catch (e) {
        console.error("[checkout] Square SDK load error:", e);
        setError(
          "Could not reach Square's payment SDK. If you're using an ad blocker or VPN, try disabling it for this page.",
        );
        return;
      }

      // Stage 2: initialize payments with the workspace's app + location.
      // The most common failure here is empty / wrong app ID — e.g. the
      // NEXT_PUBLIC_SQUARE_APPLICATION_ID env var wasn't set at build time,
      // so the value baked into the bundle is "". Square's SDK rejects
      // with a generic-looking error; we surface the exact message in the
      // console and a useful one in the UI.
      try {
        if (!squareAppId || !squareLocationId) {
          throw new Error(
            `Missing credentials at runtime — squareAppId="${squareAppId}", squareLocationId="${squareLocationId}". The NEXT_PUBLIC_SQUARE_* env vars are baked in at build time; rebuild after setting them.`,
          );
        }
        const payments = await window.Square!.payments(
          squareAppId,
          squareLocationId,
        );
        const card = await payments.card();
        await card.attach("#square-card-container");
        cardRef.current = card;
        setSdkReady(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("[checkout] Square SDK init error:", e);
        setError(
          `Could not initialize the payment form. Open the JS console for the underlying Square SDK error. ${
            message ? `Details: ${message}` : ""
          }`,
        );
      }
    }

    init();

    return () => {
      cardRef.current?.destroy();
      cardRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cardRef.current) return;
    setError(null);
    setSubmitting(true);

    // 1. Tokenize the card with Square's SDK.
    let nonce: string;
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        setError(
          result.errors?.map((err) => err.message).join(", ") ??
            "Card tokenization failed. Please check your card details.",
        );
        setSubmitting(false);
        return;
      }
      nonce = result.token;
    } catch {
      setError("Card verification failed. Please try again.");
      setSubmitting(false);
      return;
    }

    // 2. POST nonce + workspace info to our server to create the subscription.
    try {
      const res = await fetch("/api/square/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, planVariationId, cardNonce: nonce }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          (json as { error?: string }).error ??
            "Subscription failed. Please try again or contact hello@reclaimdata.ai.",
        );
        setSubmitting(false);
        return;
      }

      // Success — the subscription is created. The webhook will flip
      // workspace.plan to "professional" asynchronously (typically within a
      // second or two). Send the user to /app/settings/billing — that route
      // is allowed by the /app layout's paywall even while plan is still
      // "free", so we avoid a race where the immediate redirect to /app
      // bounces the user back to checkout before the webhook lands.
      router.push("/app/settings/billing?subscribed=1");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Square injects the card form into this container */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-sm font-medium text-foreground">
          Card details
        </p>
        <div id="square-card-container" style={{ minHeight: 89 }} />
        {!sdkReady && !error && (
          <p className="mt-3 text-xs text-muted-foreground">
            Loading secure payment form…
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!sdkReady || submitting}
      >
        {submitting ? "Processing…" : "Subscribe — $249 / month"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Your card is charged $249 on today's date each month. Cancel any time
        from your billing settings.
      </p>
    </form>
  );
}
