import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/marketing/page-header";

export const metadata: Metadata = {
  title: "About",
  description:
    "Reclaim Data is built by ReTHINK CNERGY, a California AI strategy firm helping small businesses navigate the age of AI.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Built for the business owner who still keeps a filing cabinet."
        lede="Most CRM and marketing tools assume you already have clean data. If you're a contractor, a shop owner, or a services firm with decades of paper, you don't. Reclaim Data was built to get you from there to here — honestly."
      />
      <article className="mx-auto w-full max-w-3xl space-y-8 px-6 py-20 text-lg leading-relaxed text-foreground prose-marketing">
        <p>
          We watched too many small businesses pay five figures for HubSpot or
          Salesforce and then get stuck at step zero: they had no way to get
          their existing customer records into the tool. Scanning services
          cost a fortune and handed back blurry PDFs. Manual entry took
          months. Most owners just gave up and kept paying for relationships
          they could no longer reach.
        </p>
        <p>
          Reclaim Data is the bridge. It reads the documents you already
          have — paper contracts, scanned PDFs, Word docs, Excel sheets,
          phone photos of business cards — and returns a clean, validated,
          deduplicated customer database. Every field links back to the
          document it came from, so you can always verify. Every piece of
          data carries a confidence score, so the software never pretends
          to know something it doesn't.
        </p>
        <p>
          We're a small team at{" "}
          <Link
            href="https://rethinkcnergy.com"
            className="text-accent underline-offset-4 hover:underline"
          >
            ReTHINK CNERGY
          </Link>
          , a California AI strategy firm. We consult with small and
          mid-sized businesses on how to use AI without losing the trust
          they've built over decades. Reclaim Data is the first product we
          built because it kept coming up in every conversation.
        </p>
        <p>
          We take your data seriously. We never sell it, we never use it to
          train models, and we enforce tenant isolation at three layers of
          our stack. See the{" "}
          <Link
            href="/privacy"
            className="text-accent underline-offset-4 hover:underline"
          >
            privacy policy
          </Link>{" "}
          for the details.
        </p>
      </article>
      <section className="border-t border-border/60 bg-secondary/30">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-5 px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Get in touch
          </p>
          <h2 className="font-serif text-3xl text-foreground">
            Questions, partnerships, or press?
          </h2>
          <p className="text-muted-foreground">
            Email{" "}
            <a
              href="mailto:hello@reclaimdata.ai"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              hello@reclaimdata.ai
            </a>{" "}
            — we read every message.
          </p>
          <Button asChild size="lg" variant="accent">
            <Link href="/#waitlist">Join the waitlist</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
