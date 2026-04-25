# Render Environment Variables

## Strategy

Code reads **bare names** (e.g. `SUPABASE_URL`, not `SUPABASE_URL_DEV`).  
Environment selection happens at deploy time by setting those bare names to different values in each Render service:

| Render environment | Supabase values |
|--------------------|----------------|
| Preview / Dev      | `_DEV` values from `.env.local` |
| Production         | `_PROD` values from `.env.local` |

All non-Supabase services (Anthropic, Google, Twilio, ZeroBounce, USPS, Brevo, Inngest, Sentry, PostHog, OAuth key) use the **same credentials** for both environments. For Square, sandbox credentials are used in dev and live credentials (to be created) in production.

---

## Google Auth strategy

`GOOGLE_APPLICATION_CREDENTIALS_JSON` contains the service account JSON **inlined as a string**.  
The file `~/reclaimdata-secrets/google-service-account.json` is **not** copied into the repo.  
In code, Document AI is initialized by parsing this env var — see the comment in `lib/docai.ts` (or wherever the client is initialized).

---

## Variables — Dev (Preview) deploy

Set these in the Render dev service's **Environment** tab.  
Use the `_DEV` values from `~/reclaimdata-secrets/.env.local` for Supabase; use the single value for everything else.

| Variable | Maps to in .env.local | Secret? |
|----------|----------------------|---------|
| `NEXT_PUBLIC_APP_URL` | `NEXT_PUBLIC_APP_URL` (set to your preview URL) | Plain |
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL_DEV` | Plain |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV` | Plain |
| `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY_DEV` | **Secret** |
| `SUPABASE_DB_URL` | `SUPABASE_DB_URL_DEV` | **Secret** |
| `SUPABASE_STORAGE_BUCKET` | `SUPABASE_STORAGE_BUCKET_DEV` (`reclaimdata-uploads`) | Plain |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | **Secret** |
| `GOOGLE_DOCUMENT_AI_PROJECT_ID` | `GOOGLE_DOCUMENT_AI_PROJECT_ID` (`reclaimdata`) | Plain |
| `GOOGLE_DOCUMENT_AI_LOCATION` | `GOOGLE_DOCUMENT_AI_LOCATION` (`us`) | Plain |
| `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` | `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` | Plain |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | `GOOGLE_APPLICATION_CREDENTIALS_JSON` (full JSON string) | **Secret** |
| `ZEROBOUNCE_API_KEY` | `ZEROBOUNCE_API_KEY` | **Secret** |
| `TWILIO_ACCOUNT_SID` | `TWILIO_ACCOUNT_SID` | Plain |
| `TWILIO_AUTH_TOKEN` | `TWILIO_AUTH_TOKEN` | **Secret** |
| `USPS_CLIENT_ID` | `USPS_CLIENT_ID` | Plain |
| `USPS_CLIENT_SECRET` | `USPS_CLIENT_SECRET` | **Secret** |
| `BREVO_API_KEY` | `BREVO_API_KEY` | **Secret** |
| `BREVO_SENDER_EMAIL` | `BREVO_SENDER_EMAIL` (`hello@reclaimdata.ai`) | Plain |
| `BREVO_SENDER_NAME` | `BREVO_SENDER_NAME` (`Reclaim Data`) | Plain |
| `SQUARE_ENVIRONMENT` | `sandbox` | Plain |
| `SQUARE_APPLICATION_ID` | `SQUARE_APPLICATION_ID` (sandbox value) | Plain |
| `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | same as above | Plain |
| `SQUARE_ACCESS_TOKEN` | `SQUARE_ACCESS_TOKEN` (sandbox value) | **Secret** |
| `SQUARE_LOCATION_ID` | `SQUARE_LOCATION_ID` (sandbox value) | Plain |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID` | same as above | Plain |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | `SQUARE_WEBHOOK_SIGNATURE_KEY` (sandbox value) | **Secret** |
| `SQUARE_PLAN_ID_STARTER_MONTHLY` | populate after Catalog API run | Plain |
| `SQUARE_PLAN_ID_PROFESSIONAL_MONTHLY` | populate after Catalog API run | Plain |
| `SQUARE_PLAN_ID_LEGACY_MONTHLY` | populate after Catalog API run | Plain |
| `SQUARE_PLAN_ID_STARTER_ANNUAL` | populate after Catalog API run | Plain |
| `SQUARE_PLAN_ID_PROFESSIONAL_ANNUAL` | populate after Catalog API run | Plain |
| `SQUARE_PLAN_ID_LEGACY_ANNUAL` | populate after Catalog API run | Plain |
| `INNGEST_EVENT_KEY` | `INNGEST_EVENT_KEY` | **Secret** |
| `INNGEST_SIGNING_KEY` | `INNGEST_SIGNING_KEY` | **Secret** |
| `SENTRY_DSN` | `SENTRY_DSN` | Plain |
| `NEXT_PUBLIC_POSTHOG_KEY` | `NEXT_PUBLIC_POSTHOG_KEY` | Plain |
| `NEXT_PUBLIC_POSTHOG_HOST` | `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com`) | Plain |

---

## Variables — Prod deploy

Same table as above, with these differences:

| Variable | Change for Prod |
|----------|----------------|
| `NEXT_PUBLIC_APP_URL` | `https://reclaimdata.ai` |
| `NEXT_PUBLIC_SUPABASE_URL` | Use `NEXT_PUBLIC_SUPABASE_URL_PROD` value |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Use `NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD` value |
| `SUPABASE_SERVICE_ROLE_KEY` | Use `SUPABASE_SERVICE_ROLE_KEY_PROD` value |
| `SUPABASE_DB_URL` | Use `SUPABASE_DB_URL_PROD` value |
| `SQUARE_ENVIRONMENT` | `production` |
| `SQUARE_APPLICATION_ID` / `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | Live Square app ID (create in Square Dashboard) |
| `SQUARE_ACCESS_TOKEN` | Live Square access token |
| `SQUARE_LOCATION_ID` / `NEXT_PUBLIC_SQUARE_LOCATION_ID` | Live Square location ID |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Live Square webhook signature key |
| `SQUARE_PLAN_ID_*` | Live plan IDs (created via Square Catalog API against production) |

---

## Pre-deploy blockers

Before **any** deploy (dev or prod):

- [ ] `SQUARE_PLAN_ID_*` (6 vars) must be populated — run the Catalog API script first (see SETUP_LOG.md Service 9)

Before **production** deploy:

- [ ] Square production app + location + webhook + plan IDs must be created
- [ ] Twilio upgraded from trial to pay-as-you-go
- [ ] ZeroBounce credits purchased (100/month free tier insufficient for production)
- [ ] Rotate secrets flagged in SETUP_LOG.md "Post-launch follow-ups" (DB passwords, prod Supabase secret key, Brevo API key, USPS client secret)

---

## Notes

- `GOOGLE_APPLICATION_CREDENTIALS_JSON` is a multi-line JSON string. In Render, paste the entire JSON blob (including the private key with literal `\n` sequences) as a single-line secret. Render stores it verbatim.
- Inngest keys are tied to the **Production** environment in the Inngest workspace — they work for both dev and prod deploys (Inngest routes by app URL, not by key suffix).
