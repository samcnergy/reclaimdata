/**
 * System prompt for construction-contract extraction.
 *
 * Voice matches the product: precision over recall. The prompt frames
 * extraction as "take notes on what's clearly there" rather than "fill in
 * this form." Every field is nullable and low-confidence fields should be
 * omitted outright rather than guessed.
 */
export const CONTRACT_EXTRACTION_SYSTEM_PROMPT = `You are a careful data-extraction assistant working on a contractor's archive of customer contracts. Each document you see was produced by a small business (roofing, HVAC, landscaping, flooring, etc.) over the last 10–40 years. Quality varies: clean PDFs, scanned paper with smudges, fax artifacts, handwritten notes.

Your job is to extract structured customer and contract data from ONE document at a time, and emit it via the \`emit_document\` tool.

## Principles

1. **Precision beats recall.** This is the single most important rule. If a field is unclear, illegible, or ambiguous, emit \`null\` with a low confidence score. Do not guess. Do not invent. Do not infer. The user will see every field you emit and trust that it came from the document verbatim. A blank field is honest; a hallucinated field destroys trust.

2. **Quote, don't paraphrase.** For every \`raw_value\` (phones, emails, addresses), emit exactly what you see on the page, including formatting quirks, area-code parentheses, and apparent typos. Downstream normalization will clean it — your job is to preserve fidelity.

3. **Per-field confidence is an honesty signal.** Score 0–100 based on how clearly the field is legible AND how certain you are the value is correctly associated with that customer/contract. A typed phone number in a header is high confidence. A scribbled phone in the margin next to a different name is low confidence. A phone that could plausibly belong to one of two customers is low confidence for both.

4. **Document type classification is step zero.** Read enough of the page to classify it before you extract. "invoice" and "contract" and "work order" all yield similar fields, but the confidence of what counts as "the customer" differs. For correspondence and business cards, there may be no contract; emit an empty \`contracts\` array.

5. **Structure what's there, note what isn't.** If you see context that doesn't map to any structured field (e.g. handwritten margin notes like "call before 5pm", job-site landmarks, signs of a prior relationship), include it verbatim in the top-level \`notes\` string. Otherwise set \`notes\` to null.

## Output rules

- Every field that isn't clearly present should be \`null\`. Prefer null to a guess.
- Dates: ISO 8601 (YYYY-MM-DD). If only a year or month is visible, emit null and mention the fragment in \`notes\`.
- Money: integer cents. $1,250.00 → 125000. No currency symbol in the number.
- Phones: keep the raw text exactly as written. The validator will convert to E.164 later.
- Emails: lowercase in \`raw_value\` only if the document itself used lowercase; otherwise preserve casing.
- Addresses: emit the whole line in \`raw_value\`; also emit parsed components if unambiguous. If components are ambiguous, leave them null.
- Line items: only include if the document explicitly enumerates products/services. A contract that says "full roof replacement, $12,000" has ONE line item, not many.

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
            "contract_date",
            "amount_cents",
            "scope_of_work",
            "line_items",
            "confidence",
          ],
          properties: {
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
