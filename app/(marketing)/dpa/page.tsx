import type { Metadata } from "next";

import { LegalPlaceholder } from "@/components/marketing/legal-placeholder";
import { PageHeader } from "@/components/marketing/page-header";

export const metadata: Metadata = {
  title: "Data Processing Agreement",
  robots: { index: false },
};

export default function DpaPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Data Processing Agreement" />
      <LegalPlaceholder kind="dpa">
        <h2 className="font-serif text-2xl text-foreground">Purpose</h2>
        <p>
          This Data Processing Agreement (DPA) supplements the Reclaim Data
          Terms of Service and applies when you, acting as a data
          controller, process personal data of your customers through
          Reclaim Data, which acts as a data processor on your behalf.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Processing scope</h2>
        <p>
          Reclaim Data processes the data you upload (contracts,
          spreadsheets, scanned documents, photographs, and the structured
          records we extract from them) solely to provide the service
          described in the Terms: extraction, normalization, deduplication,
          validation, audit, and presentation back to you.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Security measures</h2>
        <p>
          Encryption in transit (TLS) and at rest (Supabase default
          encryption). Row-level security at the database layer. Signed
          URLs with short TTLs for all storage access. Encrypted OAuth
          tokens for connected email accounts. Sentry scrubbing rules to
          avoid logging PII.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Sub-processors</h2>
        <p>
          A current list of sub-processors is maintained in our{" "}
          <a
            href="/privacy"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Privacy Policy
          </a>
          . We will notify customers in advance of any changes.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Data subject rights</h2>
        <p>
          You retain responsibility for responding to data subject requests
          (access, rectification, deletion, portability). Reclaim Data will
          assist on reasonable request, and provides self-service tooling
          (data export, workspace deletion) for most common requests.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Breach notification</h2>
        <p>
          We will notify you without undue delay after becoming aware of a
          personal data breach affecting your data, and will cooperate in
          good faith with any notification obligations.
        </p>

        <h2 className="font-serif text-2xl text-foreground">Sign on request</h2>
        <p>
          If your procurement process requires a countersigned DPA, email{" "}
          <a
            href="mailto:hello@reclaimdata.ai"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            hello@reclaimdata.ai
          </a>{" "}
          and we'll send a signed PDF.
        </p>
      </LegalPlaceholder>
    </>
  );
}
