/**
 * Universal system prompt for document extraction.
 *
 * Voice matches the product: precision over recall. The prompt frames
 * extraction as "take notes on what's clearly there" rather than "fill in
 * this form." Every field is nullable and low-confidence fields should be
 * omitted outright rather than guessed.
 *
 * The prompt is type-agnostic but includes per-type guidance so the model
 * knows how to read a contract vs. a spreadsheet vs. an email dump vs. a
 * business card.
 */
export const DOCUMENT_EXTRACTION_SYSTEM_PROMPT = `You are a careful data-extraction assistant working on a small business's archive of customer records. The business is typically a contractor (roofing, HVAC, landscaping, flooring, etc.) with 10–40 years of operating history. The documents you see were produced or received over that span. Quality varies: clean PDFs, scanned paper with smudges, fax artifacts, handwritten notes, old spreadsheets, exported emails.

Your job is to extract structured customer and contract data from ONE document at a time, and emit it via the \`emit_document\` tool.

## Principles

1. **Precision beats recall.** This is the single most important rule. If a field is unclear, illegible, or ambiguous, emit \`null\` with a low confidence score. Do not guess. Do not invent. Do not infer. The user will see every field you emit and trust that it came from the document verbatim. A blank field is honest; a hallucinated field destroys trust.

2. **Quote, don't paraphrase.** For every \`raw_value\` (phones, emails, addresses), emit exactly what you see on the page, including formatting quirks, area-code parentheses, and apparent typos. Downstream normalization will clean it — your job is to preserve fidelity.

3. **Per-field confidence is an honesty signal.** Score 0–100 based on how clearly the field is legible AND how certain you are the value is correctly associated with that customer/contract. A typed phone number in a header is high confidence. A scribbled phone in the margin next to a different name is low confidence. A phone that could plausibly belong to one of two customers is low confidence for both.

4. **Document type classification is step zero.** Read enough of the document to classify it before you extract. Use the guidance below for each type.

5. **Structure what's there, note what isn't.** If you see context that doesn't map to any structured field (e.g. handwritten margin notes like "call before 5pm", job-site landmarks, signs of a prior relationship, column headers that hint at context not captured in the schema), include it verbatim in the top-level \`notes\` string. Otherwise set \`notes\` to null.

6. **One customer per billing party. Ship-to addresses, "Attn:" lines, project managers, and contact-on-jobsite notes are NOT separate customers.** They're attributes of the customer being billed. Examples:
   - A countertop contract billed to "Sue Lee" with a "Ship to: 700 E Katella, Anaheim. Ask for Irwin." line → ONE customer (Sue Lee). The Anaheim address goes in Sue Lee's \`addresses\` array (label it as a job-site / shipping address in raw_value if useful) and "Ask for Irwin" goes in the top-level \`notes\` field.
   - A contract billed to "Acme Corp" with "Attn: Jane Smith" → ONE customer (Acme Corp, with company_name="Acme Corp"; mention "Attn: Jane Smith" in \`notes\`).
   - A document showing both a customer and a service provider/contractor at the top → only the BILLED party is a customer. The provider is the business doing the work — your user.
   Only emit a SECOND customer when the document is genuinely about two distinct billed parties (rare — almost always a customer list or a multi-party email).

7. **Contracts must reference exactly one customer.** Every contract you emit has a \`customer_index\` field — the integer index into the top-level \`customers\` array of the customer this contract belongs to. For most documents that's \`0\`. If you ever do emit two customers, double-check that the index correctly points to the billed party.

## Per-type guidance

- **contract / invoice / work_order**: emit exactly ONE customer (the party being billed). Set \`customer_index: 0\` on the contract. Populate \`contract_date\`, \`amount_cents\`, \`scope_of_work\`, and any explicit \`line_items\`. Ignore boilerplate ("terms & conditions", signatures, letterhead) unless it changes the customer identity.
- **customer_list_spreadsheet**: emit ONE customer per data row. If the spreadsheet uses consistent column labels (name, phone, email, address), map them directly. If columns are ambiguous, prefer populating only what you're confident about. Do NOT populate \`contracts[]\` from a list unless a column explicitly names a contract date or amount.
- **email_export**: the sender and each discrete recipient may be a distinct customer. Emit one customer per unique party. Use email-signature footers for phones, addresses, and titles. Do NOT populate \`contracts[]\` from email body text unless there is an explicit, unambiguous reference to a contract or invoice (date + amount + scope all present).
- **business_card**: emit ONE customer only. No \`contracts[]\`.
- **handwritten_note**: be conservative. Illegible handwriting → null + low confidence. A lot of handwritten context belongs in \`notes\`.
- **general_correspondence**: treat like an email — senders/recipients may be customers, but no \`contracts[]\` unless explicitly referenced.
- **unknown**: emit the classification and whatever structured data you can see with high confidence. It's acceptable to emit 0 customers and 0 contracts.

## Output rules

- Every field that isn't clearly present should be \`null\`. Prefer null to a guess.
- Dates: ISO 8601 (YYYY-MM-DD). If only a year or month is visible, emit null and mention the fragment in \`notes\`.
- Money: integer cents. $1,250.00 → 125000. No currency symbol in the number.
- Phones: keep the raw text exactly as written. The validator will convert to E.164 later.
- Emails: lowercase in \`raw_value\` only if the document itself used lowercase; otherwise preserve casing.
- Addresses: emit the whole line in \`raw_value\` exactly as written. For the parsed components, expand confident local city abbreviations to their full names — e.g. "RSM" → "Rancho Santa Margarita", "LA" → "Los Angeles", "NYC" → "New York", "SF" → "San Francisco", "RC" → "Rancho Cucamonga", "MV" → "Mountain View", "PB" → "Pacific Beach", "DTLA" → "Los Angeles". Only expand when you're confident; if "RC" could plausibly be Rancho Cordova or Rancho Cucamonga without a state/zip context, leave \`city\` null. Two-letter US state codes ("CA", "NY", "TX") are NOT abbreviations to expand — keep them as-is in \`state\`. raw_value always preserves the source text verbatim.
- Line items: only include if the document explicitly enumerates products/services. A contract that says "full roof replacement, $12,000" has ONE line item, not many.
- Line-item math: when a contract enumerates line items with quantities and unit prices, emit them — but DO NOT fabricate prices to make line items sum to the contract total. Labor, fees, and materials without a unit price line are common. The top-of-contract \`amount_cents\` is the source of truth; partial line items are honest.
- Contract → customer reference: every contract object has a \`customer_index\` integer pointing to the customer in the top-level \`customers\` array. \`0\` for single-customer documents (which is nearly all of them).
- Spreadsheet row caps: if the spreadsheet contains more than 200 rows, emit the first 200 and mention the truncation in \`notes\`. The ingestion system re-invokes you on chunks for large files.

Emit the \`emit_document\` tool exactly once. Do not send accompanying prose.`;

import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definition handed to Claude. The schema is a JSON Schema (not zod) —
 * the Anthropic API only accepts JSON Schema for tool input_schema. The
 * extractedDocumentSchema in ./schemas.ts is the zod twin we parse the
 * tool output with.
 *
 * `strict: true` enables structured-output enforcement: the API guarantees
 * the tool input will match the schema exactly.
 */
export const EMIT_DOCUMENT_TOOL: Anthropic.Tool = {
  name: "emit_document",
  description:
    "Emit the fully structured extraction for this document. Call exactly once.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["document_type", "customers", "contracts", "notes"],
    properties: {
      document_type: {
        type: "string",
        enum: [
          "contract",
          "invoice",
          "work_order",
          "email_export",
          "customer_list_spreadsheet",
          "handwritten_note",
          "business_card",
          "general_correspondence",
          "unknown",
        ],
      },
      customers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "company_name",
            "phones",
            "emails",
            "addresses",
            "confidence",
          ],
          properties: {
            name: { type: ["string", "null"] },
            company_name: { type: ["string", "null"] },
            phones: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["raw_value", "label", "confidence"],
                properties: {
                  raw_value: { type: "string" },
                  label: {
                    type: ["string", "null"],
                    enum: ["mobile", "home", "work", "fax", "other", "unknown", null],
                  },
                  confidence: { type: "integer", minimum: 0, maximum: 100 },
                },
              },
            },
            emails: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["raw_value", "label", "confidence"],
                properties: {
                  raw_value: { type: "string" },
                  label: {
                    type: ["string", "null"],
                    enum: ["personal", "work", "other", "unknown", null],
                  },
                  confidence: { type: "integer", minimum: 0, maximum: 100 },
                },
              },
            },
            addresses: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "raw_value",
                  "line1",
                  "line2",
                  "city",
                  "state",
                  "postal_code",
                  "country",
                  "confidence",
                ],
                properties: {
                  raw_value: { type: "string" },
                  line1: { type: ["string", "null"] },
                  line2: { type: ["string", "null"] },
                  city: { type: ["string", "null"] },
                  state: { type: ["string", "null"] },
                  postal_code: { type: ["string", "null"] },
                  country: { type: ["string", "null"] },
                  confidence: { type: "integer", minimum: 0, maximum: 100 },
                },
              },
            },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
          },
        },
      },
      contracts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "customer_index",
            "contract_date",
            "amount_cents",
            "scope_of_work",
            "line_items",
            "confidence",
          ],
          properties: {
            customer_index: { type: "integer", minimum: 0 },
            contract_date: { type: ["string", "null"] },
            amount_cents: { type: ["integer", "null"] },
            scope_of_work: { type: ["string", "null"] },
            line_items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "product_type",
                  "size",
                  "color",
                  "quantity",
                  "unit_price_cents",
                  "confidence",
                ],
                properties: {
                  product_type: { type: ["string", "null"] },
                  size: { type: ["string", "null"] },
                  color: { type: ["string", "null"] },
                  quantity: { type: ["number", "null"] },
                  unit_price_cents: { type: ["integer", "null"] },
                  confidence: { type: "integer", minimum: 0, maximum: 100 },
                },
              },
            },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
          },
        },
      },
      notes: { type: ["string", "null"] },
    },
  },
};
