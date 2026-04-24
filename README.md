# Reclaim Data

> Reclaim the golden data hidden in your filing cabinet.

Reclaim Data turns decades of paper contracts, Word documents, scanned PDFs,
spreadsheets, and emails into a clean, validated, marketable customer
database. A ReTHINK CNERGY product.

## Stack

- **Next.js 16** (App Router, RSC, TypeScript strict) — single app serving both marketing routes and the auth-gated `/app` product
- **Tailwind CSS v4** with brand tokens in `app/globals.css`
- **shadcn/ui** (Radix primitives, new-york style)
- **Supabase** — Auth, Postgres, Storage (one vendor, one bill)
- **Drizzle ORM** against Supabase Postgres (with RLS enforced in SQL)
- **Inngest** — background job orchestration (extraction pipeline, validation, audit)
- **Anthropic Claude Sonnet 4.6** — structured extraction via tool use
- **Google Document AI** — OCR fallback for low-quality scans
- **Twilio Lookup** / **ZeroBounce** / **Smarty** — phone / email / address validation
- **Brevo** — transactional email (magic links, audit-complete notifications)
- **Square Subscriptions** — billing (custom in-app portal, no hosted portal)
- **PostHog** + **Plausible** — product & marketing analytics
- **Sentry** — error tracking
- **Render** — deploy target

> **Architectural note:** the build prompt specified Next.js 15. This scaffold
> uses Next 16 (current stable as of 2026-04). Next 16 is backward-compatible
> with Next 15 App Router conventions. Downgrade by pinning `next@15.x` in
> `package.json` if required.

## Getting started

```bash
cp .env.example .env.local
# Fill in Supabase URL + anon key at minimum
npm install
npm run dev
```

Open http://localhost:3000.

## Setup checklist (before first real use)

External accounts to provision:

1. **Supabase** — project, URL + anon key + service role + pooler DB URL. Create Storage bucket `reclaimdata-uploads` (private).
2. **Anthropic** — API key with Sonnet 4.6 access.
3. **Google Cloud** — Document AI processor + service-account JSON.
4. **Twilio** — Account SID + auth token (Lookup API enabled).
5. **ZeroBounce** — API key.
6. **Smarty** — US Street API credentials.
7. **Brevo** — API key + verified sender domain (`reclaimdata.ai` with SPF, DKIM, DMARC).
8. **Inngest** — app + event/signing keys.
9. **Google OAuth** — client ID + secret (scope: `gmail.readonly`).
10. **Square** — sandbox + production credentials, subscription plans for Starter / Professional / Legacy × monthly + annual, webhook signature key.
11. **PostHog** — project API key.
12. **Sentry** — DSN.
13. **OAuth token encryption key** — `openssl rand -hex 32`.

## Scripts

```bash
npm run dev     # Next.js dev server
npm run build   # Production build
npm start       # Production server
npm run lint    # ESLint
```

Drizzle (populated in milestone 2):

```bash
npx drizzle-kit generate  # generate SQL migrations from schema
npx drizzle-kit push      # apply migrations to Supabase DB
```

## Repository layout

```
app/                # Next.js App Router
  (marketing)/      # public marketing routes
  (auth)/           # login/signup
  app/              # auth-gated product surfaces
  api/              # route handlers
components/
  ui/               # shadcn primitives
  marketing/        # landing-page sections
  app/              # product components (drawer, table, dropzone, etc.)
lib/
  supabase/         # browser + server + admin clients
  db/               # Drizzle client + schema + RLS policies
  extraction/       # Claude prompts, schemas, OCR
  validation/       # Twilio / ZeroBounce / Smarty wrappers
  inngest/          # background job definitions
  square/           # subscription lifecycle helpers
  brevo/            # transactional email helpers
drizzle/            # generated migrations + hand-written RLS SQL
public/             # static assets
```

## Build milestones

This scaffold is **milestone 1** of 18. Subsequent milestones add schema + RLS,
marketing pages, waitlist, auth, upload pipeline, extraction, validation,
client list UI, audit report, Gmail sync, billing, security hardening, and
polish — each committed and pushed independently.

## License

Proprietary. © ReTHINK CNERGY.
