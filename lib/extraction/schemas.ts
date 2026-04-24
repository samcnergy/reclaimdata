import { z } from "zod";

/**
 * Canonical structured output for every document extraction.
 *
 * Precision over recall: every field is nullable and every field carries a
 * confidence integer 0–100. The prompt instructs Claude to emit `null` with
 * the lowest confidence (or simply omit questionable fields) rather than
 * fabricate. Downstream validators + dedupe treat nulls as legitimate
 * "we don't know yet" signals, not errors.
 */

const confidence = z.number().int().min(0).max(100);

export const extractedPhoneSchema = z.object({
  raw_value: z.string().min(1).describe("Phone number exactly as it appears in the source."),
  label: z
    .enum(["mobile", "home", "work", "fax", "other", "unknown"])
    .nullable()
    .describe("Label the document uses (e.g. 'mobile', 'office')."),
  confidence,
});

export const extractedEmailSchema = z.object({
  raw_value: z.string().min(1).describe("Email as it appears in the source."),
  label: z.enum(["personal", "work", "other", "unknown"]).nullable(),
  confidence,
});

export const extractedAddressSchema = z.object({
  raw_value: z.string().min(1).describe("Address as a single line, exactly as it appears."),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  confidence,
});

export const extractedLineItemSchema = z.object({
  product_type: z.string().nullable(),
  size: z.string().nullable(),
  color: z.string().nullable(),
  quantity: z.number().nullable(),
  unit_price_cents: z.number().int().nullable(),
  confidence,
});

export const extractedContractSchema = z.object({
  contract_date: z
    .string()
    .nullable()
    .describe("ISO 8601 date (YYYY-MM-DD) or null if ambiguous."),
  amount_cents: z.number().int().nullable().describe("Total contract amount in cents."),
  scope_of_work: z.string().nullable().describe("Short summary of what was sold or done."),
  line_items: z.array(extractedLineItemSchema),
  confidence,
});

export const extractedCustomerSchema = z.object({
  name: z.string().nullable().describe("Full individual name if present."),
  company_name: z.string().nullable(),
  phones: z.array(extractedPhoneSchema),
  emails: z.array(extractedEmailSchema),
  addresses: z.array(extractedAddressSchema),
  confidence,
});

export const extractedDocumentSchema = z.object({
  document_type: z.enum([
    "contract",
    "invoice",
    "work_order",
    "email_export",
    "customer_list_spreadsheet",
    "handwritten_note",
    "business_card",
    "general_correspondence",
    "unknown",
  ]),
  customers: z
    .array(extractedCustomerSchema)
    .describe(
      "Customers identified in this document. Typically 1 for a contract; may be more for a list or email dump.",
    ),
  contracts: z
    .array(extractedContractSchema)
    .describe(
      "Contracts / invoices / orders that appear in this document. Usually 1 per contract file, can be 0 for correspondence or business cards.",
    ),
  notes: z
    .string()
    .nullable()
    .describe("Free-text observations extraction caught that don't fit any structured field."),
});

export type ExtractedDocument = z.infer<typeof extractedDocumentSchema>;
export type ExtractedCustomer = z.infer<typeof extractedCustomerSchema>;
export type ExtractedContract = z.infer<typeof extractedContractSchema>;
export type ExtractedLineItem = z.infer<typeof extractedLineItemSchema>;
export type ExtractedPhone = z.infer<typeof extractedPhoneSchema>;
export type ExtractedEmail = z.infer<typeof extractedEmailSchema>;
export type ExtractedAddress = z.infer<typeof extractedAddressSchema>;
