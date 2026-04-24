import Link from "next/link";

/**
 * Slim band communicating Reclaim Data's relationship to the parent firm.
 * Used inline on long-form pages; the footer carries a compact echo.
 */
export function ParentStrip() {
  return (
    <section className="border-y border-border/60 bg-secondary/40">
      <div className="mx-auto w-full max-w-4xl px-6 py-12 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          A ReTHINK CNERGY product
        </p>
        <p className="mt-4 text-balance font-serif text-2xl leading-snug text-foreground">
          Reclaim Data is built by{" "}
          <Link
            href="https://rethinkcnergy.com"
            className="text-accent underline-offset-4 hover:underline"
          >
            ReTHINK CNERGY
          </Link>
          , a California AI strategy firm helping small businesses navigate the
          age of AI.
        </p>
      </div>
    </section>
  );
}
