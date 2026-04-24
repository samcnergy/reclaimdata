import Link from "next/link";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.12),transparent_60%)]" />
      <div className="mx-auto w-full max-w-4xl px-6 pt-24 pb-20 text-center sm:pt-32">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          A ReTHINK CNERGY product
        </p>
        <h1 className="mt-6 text-balance font-serif text-5xl font-medium leading-[1.05] text-foreground sm:text-6xl lg:text-7xl">
          The golden customer data hiding in your filing cabinet — finally
          reclaimed.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
          Reclaim Data turns decades of paper contracts, Word docs, and emails
          into a clean, searchable customer database you can actually market
          to.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="accent">
            <Link href="#waitlist">Join the waitlist</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
