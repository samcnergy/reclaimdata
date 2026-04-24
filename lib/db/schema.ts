/**
 * Drizzle schema for Reclaim Data.
 *
 * Every tenant-scoped table carries `workspace_id` and is protected by
 * Postgres Row-Level Security policies in `lib/db/rls-policies.sql`.
 * See CLAUDE.md "Multi-tenancy" for the three-layer enforcement model.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ----------------------------------------------------------------------- */
/* Enums                                                                   */
/* ----------------------------------------------------------------------- */

export const workspacePlanEnum = pgEnum("workspace_plan", [
  "free",
  "starter",
  "professional",
  "legacy",
]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
]);

export const uploadStatusEnum = pgEnum("upload_status", [
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const extractionRunStatusEnum = pgEnum("extraction_run_status", [
  "completed",
  "failed",
]);

export const phoneLineTypeEnum = pgEnum("phone_line_type", [
  "mobile",
  "landline",
  "voip",
  "unknown",
]);

export const phoneValidationStatusEnum = pgEnum("phone_validation_status", [
  "unvalidated",
  "valid",
  "invalid",
  "disconnected",
]);

export const emailValidationStatusEnum = pgEnum("email_validation_status", [
  "unvalidated",
  "valid",
  "risky",
  "invalid",
  "disposable",
  "catch_all",
]);

export const addressValidationStatusEnum = pgEnum("address_validation_status", [
  "unvalidated",
  "valid",
  "invalid",
  "missing_unit",
  "vacant",
]);

export const duplicateCandidateStatusEnum = pgEnum(
  "duplicate_candidate_status",
  ["pending", "merged", "dismissed"],
);

export const emailProviderEnum = pgEnum("email_provider", [
  "gmail",
  "outlook",
]);

/* ----------------------------------------------------------------------- */
/* Users & workspaces                                                      */
/* ----------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  plan: workspacePlanEnum("plan").notNull().default("free"),
  squareCustomerId: text("square_customer_id"),
  squareSubscriptionId: text("square_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    invitedBy: uuid("invited_by").references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

/* ----------------------------------------------------------------------- */
/* Uploads & extraction                                                    */
/* ----------------------------------------------------------------------- */

export const uploads = pgTable("uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  pageCount: integer("page_count"),
  status: uploadStatusEnum("status").notNull().default("queued"),
  errorMessage: text("error_message"),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const extractionRuns = pgTable("extraction_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploadId: uuid("upload_id")
    .notNull()
    .references(() => uploads.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  rawResponseStoragePath: text("raw_response_storage_path"),
  status: extractionRunStatusEnum("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------------------------------------------------- */
/* Customers & their contact info                                          */
/* ----------------------------------------------------------------------- */

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  namePrefix: text("name_prefix"),
  nameSuffix: text("name_suffix"),
  companyName: text("company_name"),
  healthScore: integer("health_score").notNull().default(0),
  confidenceScore: integer("confidence_score").notNull().default(0),
  // Nullable FKs to the primary phone/email/address — filled in after the
  // child rows exist. Intentionally no references() here to avoid circular
  // dependency with phones/emails/addresses.
  primaryPhoneId: uuid("primary_phone_id"),
  primaryEmailId: uuid("primary_email_id"),
  primaryAddressId: uuid("primary_address_id"),
  lastContractDate: date("last_contract_date"),
  totalContractValue: integer("total_contract_value"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  doNotContact: boolean("do_not_contact").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const phones = pgTable("phones", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  rawValue: text("raw_value").notNull(),
  e164Value: text("e164_value"),
  lineType: phoneLineTypeEnum("line_type"),
  carrier: text("carrier"),
  validationStatus: phoneValidationStatusEnum("validation_status")
    .notNull()
    .default("unvalidated"),
  validationCheckedAt: timestamp("validation_checked_at", {
    withTimezone: true,
  }),
  confidence: integer("confidence").notNull().default(0),
  sourceRefs: jsonb("source_refs").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  rawValue: text("raw_value").notNull(),
  normalizedValue: text("normalized_value"),
  validationStatus: emailValidationStatusEnum("validation_status")
    .notNull()
    .default("unvalidated"),
  validationCheckedAt: timestamp("validation_checked_at", {
    withTimezone: true,
  }),
  confidence: integer("confidence").notNull().default(0),
  sourceRefs: jsonb("source_refs").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  rawValue: text("raw_value").notNull(),
  line1: text("line1"),
  line2: text("line2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").notNull().default("US"),
  validationStatus: addressValidationStatusEnum("validation_status")
    .notNull()
    .default("unvalidated"),
  validationCheckedAt: timestamp("validation_checked_at", {
    withTimezone: true,
  }),
  confidence: integer("confidence").notNull().default(0),
  sourceRefs: jsonb("source_refs").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------------------------------------------------- */
/* Contracts & line items                                                  */
/* ----------------------------------------------------------------------- */

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  contractDate: date("contract_date"),
  amountCents: integer("amount_cents"),
  scopeOfWork: text("scope_of_work"),
  confidence: integer("confidence").notNull().default(0),
  sourceRefs: jsonb("source_refs").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lineItems = pgTable("line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .notNull()
    .references(() => contracts.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productType: text("product_type"),
  size: text("size"),
  color: text("color"),
  quantity: numeric("quantity"),
  unitPriceCents: integer("unit_price_cents"),
});

/* ----------------------------------------------------------------------- */
/* Notes, duplicates, audits                                               */
/* ----------------------------------------------------------------------- */

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const duplicateCandidates = pgTable("duplicate_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  customerAId: uuid("customer_a_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  customerBId: uuid("customer_b_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  reason: text("reason").notNull(),
  status: duplicateCandidateStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  totalCustomers: integer("total_customers").notNull().default(0),
  completeCustomers: integer("complete_customers").notNull().default(0),
  missingPhone: integer("missing_phone").notNull().default(0),
  missingEmail: integer("missing_email").notNull().default(0),
  missingAddress: integer("missing_address").notNull().default(0),
  invalidPhones: integer("invalid_phones").notNull().default(0),
  invalidEmails: integer("invalid_emails").notNull().default(0),
  invalidAddresses: integer("invalid_addresses").notNull().default(0),
  duplicatesDetected: integer("duplicates_detected").notNull().default(0),
  inactiveOver12Months: integer("inactive_over_12_months").notNull().default(0),
  inactiveOver5Years: integer("inactive_over_5_years").notNull().default(0),
  reportJson: jsonb("report_json").notNull().default(sql`'{}'::jsonb`),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  runBy: uuid("run_by").references(() => users.id),
});

/* ----------------------------------------------------------------------- */
/* Non-tenant-scoped & connections                                         */
/* ----------------------------------------------------------------------- */

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  company: text("company"),
  industry: text("industry"),
  approximateCustomerCount: text("approximate_customer_count"),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emailConnections = pgTable("email_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: emailProviderEnum("provider").notNull(),
  emailAddress: text("email_address").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------------------------------------------------- */
/* Exports                                                                 */
/* ----------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
export type ExtractionRun = typeof extractionRuns.$inferSelect;
export type NewExtractionRun = typeof extractionRuns.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Phone = typeof phones.$inferSelect;
export type NewPhone = typeof phones.$inferInsert;
export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type LineItem = typeof lineItems.$inferSelect;
export type NewLineItem = typeof lineItems.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type DuplicateCandidate = typeof duplicateCandidates.$inferSelect;
export type NewDuplicateCandidate = typeof duplicateCandidates.$inferInsert;
export type Audit = typeof audits.$inferSelect;
export type NewAudit = typeof audits.$inferInsert;
export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;
export type EmailConnection = typeof emailConnections.$inferSelect;
export type NewEmailConnection = typeof emailConnections.$inferInsert;
