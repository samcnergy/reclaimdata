import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/marketing/legal-placeholder";
import { PageHeader } from "@/components/marketing/page-header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy Policy" />
      <LegalPlaceholder kind="privacy">
        <h2 className="font-serif text-2xl text-foreground">What we collect</h2>
        <p>
          When you create an account, we collect your email address and
          optional profile information. When you upload documents, we store
          them in encrypted storage and process them to extract structured
          customer data. We also collect basic usage analytics (page views,
          feature usage) via PostHog, and we use Sentry for error tracking.
        </p>

        <h2 className="font-serif text-2xl text-foreground">How we use it</h2>
        <p>
          We use your data only to provide the Reclaim Data service to you.
          We do not sell your data. We do not use your data, or your
          customers' data, to train AI models. We do not share your data
          with third parties except the service providers needed to run the
          product (hosting, validation APIs, transactional email), and only
          to the extent strictly necessary.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Tenant isolation</h2>
        <p>
          Every piece of data in Reclaim Data is scoped to a workspace.
          Access is enforced at three layers: application routes, database
          queries, and Postgres row-level security policies. A customer in
          your workspace is never visible to users outside your workspace.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Sub-processors</h2>
        <p>
          We use Supabase (database and storage), Render (hosting),
          Anthropic (extraction), Google Cloud (OCR, Gmail OAuth), Twilio
          (phone validation), ZeroBounce (email validation), USPS (address
          validation), Brevo (transactional email), Square (payments),
          Inngest (background jobs), PostHog (analytics), and Sentry
          (error tracking).
        </p>

        <h2 className="font-serif text-2xl text-foreground">Your rights</h2>
        <p>
          You can export your data as a ZIP of CSV files from Settings at
          any time. You can delete your workspace at any time; deletion is
          permanent. Email{" "}
          <a
            href="mailto:hello@reclaimdata.ai"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            hello@reclaimdata.ai
          </a>{" "}
          for any privacy-related request.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Contact</h2>
        <p>
          Reclaim Data is a product of ReTHINK CNERGY. For privacy inquiries,
          email{" "}
          <a
            href="mailto:hello@reclaimdata.ai"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            hello@reclaimdata.ai
          </a>
          .
        </p>
      </LegalPlaceholder>
    </>
  );
}
