import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Shared shell for /privacy, /terms, /dpa. The copy below is a starter
 * placeholder. Before launch it MUST be reviewed by an attorney familiar
 * with the jurisdictions Reclaim Data operates in.
 */
export function LegalPlaceholder({
  kind,
  children,
}: {
  kind: "privacy" | "terms" | "dpa";
  children: React.ReactNode;
}) {
  const titles = {
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    dpa: "Data Processing Agreement",
  };

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="flex gap-3 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm text-foreground">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-accent"
          strokeWidth={2}
        />
        <p>
          <strong className="font-semibold">Placeholder copy.</strong> This{" "}
          {titles[kind]} is a starter draft and has not been reviewed by an
          attorney. It must be replaced with reviewed text before Reclaim
          Data leaves private beta. Questions? Email{" "}
          <Link
            href="mailto:hello@reclaimdata.ai"
            className="font-medium text-accent hover:underline"
          >
            hello@reclaimdata.ai
          </Link>
          .
        </p>
      </div>
      <div className="prose-marketing mt-10 space-y-6 text-base leading-relaxed text-foreground">
        {children}
      </div>
      <p className="mt-16 text-sm text-muted-foreground">
        Last updated: 2026-04-24 (placeholder).
      </p>
    </article>
  );
}
