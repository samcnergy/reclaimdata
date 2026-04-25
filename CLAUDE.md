# CLAUDE.md — project conventions

Short reference for AI tools and future contributors. Long-form specs live in
the build prompt; only keep things here that are non-obvious from reading the
code.

## Environment variables

- **Code reads bare names only.** No `_DEV` / `_PROD` suffixes and no
  runtime `NODE_ENV` branching. Each deploy sets the bare names to the
  appropriate environment's values.
- **Ledger of secrets:** `~/reclaimdata-secrets/.env.local` — outside the
  repo, gitignored globally and locally, holds the authoritative
  `_DEV` / `_PROD` pairs that feed into Render.
- **Local dev:** `/reclaimdata/.env.local` uses DEV Supabase values. Not
  committed.
- **Render mapping:** `docs/render-env-vars.md`.
- **Google credentials:** read `GOOGLE_APPLICATION_CREDENTIALS_JSON` as an
  inlined single-line JSON string; `JSON.parse()` at client init. Never read
  a file path, never copy `google-service-account.json` into the repo.

## Deviations from the original build prompt

The prompt at `docs/build-prompt.md` (not committed) was updated during
setup. Code must follow the updates, not the original:

| Area               | Original prompt                      | Actual                                                                         |
|--------------------|--------------------------------------|--------------------------------------------------------------------------------|
| Address validation | Smarty (`SMARTY_AUTH_ID/TOKEN`)     | **USPS** (`USPS_CLIENT_ID`/`USPS_CLIENT_SECRET`), OAuth2 client-credentials against `https://apis.usps.com/oauth2/v3/token` |
| Square webhook failure event | `invoice.payment_failed`   | `invoice.scheduled_charge_failed`                                              |
| Supabase API keys  | Legacy JWT (`anon`, `service_role`) | New format (`sb_publishable_…`, `sb_secret_…`). SDK is format-agnostic.         |
| Square plan IDs    | Pre-provision in Dashboard           | **Deferred.** Dashboard UI didn't expose IDs; Catalog API returned `{}`. Milestone 15 adds `scripts/bootstrap-square-plans.ts` that POSTs to `/v2/catalog/object` and writes IDs back to the ledger. |
| Plausible          | Listed as optional service           | Skipped. PostHog only.                                                          |
| Next.js version    | 15                                   | 16.2 (current stable on 2026-04 scaffold date; backward-compatible with App Router conventions from 15). |
| Inngest app model  | Per-app keys                         | Environment-scoped. Single `Production` event+signing key works across deploys. |

## Multi-tenancy

Every tenant-scoped table has a `workspaceId` column. Three enforcement
layers — a request that bypasses any one of them must still fail:

1. Route guards in `app/app/layout.tsx` and server actions verify the
   authenticated user is a member of the active workspace.
2. Drizzle query helpers in `lib/db/queries/` always inject `workspaceId`
   into `WHERE` clauses. Never write a raw query against a tenant-scoped
   table without it.
3. Postgres Row-Level Security policies (SQL migration in
   `lib/db/rls-policies.sql`) restrict SELECT/INSERT/UPDATE/DELETE to rows
   whose workspace the authenticated Supabase user belongs to. This is the
   defense-in-depth layer that catches bugs in layers 1 and 2.

## Storage

- Single private bucket `reclaimdata-uploads` per Supabase project.
- File paths are namespaced `{workspaceId}/{uuid}-{filename}`.
- Bucket RLS policies restrict access to files whose path prefix matches a
  workspace the user belongs to.
- All client access via signed URLs with short TTLs (5 min default).

## Background jobs

- Inngest. Client in `lib/inngest/client.ts`, functions in
  `lib/inngest/functions/`, handler at `app/api/inngest/route.ts`.
- Events use dot-namespaced names: `extraction.file.process`,
  `pipeline.build-list`, `validation.phone`, etc.
- Never pass secret data through Inngest event payloads — pass IDs, look
  them up inside the function.

## AI extraction

- Claude Sonnet 4.6 via `@anthropic-ai/sdk` using **tool use with strict
  JSON schemas**. Never parse free-form prose.
- Every extracted field carries an integer `confidence` 0-100.
- **Precision over recall**: leave a field null rather than fabricate a
  medium-confidence value. Trust in the product depends on this.
- Prompts live in `lib/extraction/prompts/` — one file per document type.

## Security

- TLS + HSTS on Render (default).
- Strict Content-Security-Policy.
- Never log PII. Scrubbing rules configured in Sentry init.
- Rate limiting on `/api/waitlist`, `/api/build-list`, `/api/audit/run`.

## Build milestones

18 milestones (see build plan). Commit after each. Milestone status lives
in git history — don't track it here.
