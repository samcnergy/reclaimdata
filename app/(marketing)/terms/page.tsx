import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/marketing/legal-placeholder";
import { PageHeader } from "@/components/marketing/page-header";

export const metadata: Metadata = {
  title: "Terms of Service",
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms of Service" />
      <LegalPlaceholder kind="terms">
        <h2 className="font-serif text-2xl text-foreground">Acceptance</h2>
        <p>
          By creating an account or using the Reclaim Data service, you
          agree to these terms. If you're using the service on behalf of a
          business, you represent that you have authority to bind that
          business.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Your data</h2>
        <p>
          You retain all rights to your data and your customers' data. You
          grant us a limited license to process it solely to provide the
          Reclaim Data service. We do not claim ownership and do not use
          your data to train AI models.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Billing</h2>
        <p>
          Paid plans are billed through Square. Plans renew automatically at
          the end of each billing cycle. You can cancel at any time from
          Settings → Billing; cancellation takes effect at the end of the
          current cycle. No refunds for partial months unless required by
          law.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Acceptable use</h2>
        <p>
          You agree not to use Reclaim Data to process data you don't have
          the right to process, to attempt to reverse-engineer the service,
          or to abuse third-party validation APIs routed through our
          service.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these terms. If
          your account is terminated, you will have 30 days to export your
          data before it is permanently deleted.
        </p>

        <h2 className="font-serif text-2xl text-foreground">
          Disclaimers and limits
        </h2>
        <p>
          The service is provided "as is." Extraction results depend on
          document quality and may contain errors; you are responsible for
          reviewing and confirming data before acting on it. Our total
          liability is limited to the amount you paid us in the preceding
          twelve months.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Contact</h2>
        <p>
          Questions: email{" "}
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
