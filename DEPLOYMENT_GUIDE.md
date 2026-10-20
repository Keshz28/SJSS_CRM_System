# Vercel and Gemini setup — 20 October 2026

Status: Vercel and Gemini chosen; provider accounts/projects and credentials are
not configured. Automatic Vercel deployments remain disabled. This guide records
the sequence; the owner is being guided through one stage at a time in chat.
No purchases, external account changes or deployments have been made by this step.

## 1. Sign into the provider dashboards

- Vercel: use **Continue with GitHub** with the account that owns
  `Keshz28/SJSS_CRM_System`. If an account already exists, reuse it. Stop at the
  dashboard; do not import or deploy the repository yet.
- Supabase: use **Continue with GitHub**. Stop at the dashboard; project creation
  and the database/file-storage plan will be handled in the next stage.
- Google AI Studio: sign in with the Google account that owns Google AI Pro.
  Do not send passwords, API keys, database URLs or screenshots containing secrets
  through chat. Stop before enabling paid billing or generating a separate CRM key.

Links: [Vercel](https://vercel.com/signup), [Supabase](https://supabase.com/dashboard),
[Google AI Studio](https://aistudio.google.com/).

## 2. Choose service plans and create the hosted database

Confirm costs before any checkout. Vercel Pro starts at US$20/month for the business
website. Supabase Pro starts at US$25/month for the database and files; a Free
project can be used for an initial test within its limits. The Free plan does not
provide the Pro backup arrangement and should not be treated as the complete live
backup plan. Domain, taxes, usage, AI and independent file backups are separate.

Create one dedicated Supabase CRM project for both companies. Pick a nearby
region offered by the dashboard, preferably Singapore when available. Keep the
database password in a password manager. Do not reuse the local database password.
Keep the original local database unchanged while creating and testing the hosted
copy.

Use the official Prisma connection instructions to distinguish the pooled runtime
connection from the direct/session connection used for migrations. Require TLS
and use separate, least-privilege runtime credentials rather than a general admin
database login. Connections and secrets belong in ignored local environment files
and Vercel's environment-variable settings, never GitHub or chat.

The CRM authenticates through NextAuth and its own server APIs. It does not use
Supabase Auth or expose the database directly to browsers. Disable the Supabase
Data API for this dedicated project where available, and apply the reviewed
table-grant/RLS protections before introducing customer information. SQL-created
tables can otherwise inherit Data API grants on existing Supabase projects.
`npm run security:check` now flags browser-role access to CRM tables when those
roles exist. Do not add permissive anon/authenticated policies to fix connection
errors; the server connection permissions must be configured correctly instead.

References: [Vercel pricing](https://vercel.com/pricing),
[Supabase pricing](https://supabase.com/pricing),
[Prisma connections](https://supabase.com/docs/guides/database/prisma),
[Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).

## 3. Prepare private uploads before a Vercel deployment

Create a private Supabase Storage bucket. Do not make it public or grant anonymous
uploads/downloads. Keep elevated storage credentials server-side.

Implementation is still required: direct signed uploads and short-lived private
downloads, authorization, final type/size validation, retry deduplication and
transfer/verification of existing local attachments. The current filesystem upload
backend cannot be made durable on Vercel by setting an environment variable.
Vercel Functions have a 4.5 MB request/response body limit, below the CRM's existing
10 MB documents and 50 MB site media; uploads must bypass the Function body path.
This version must not be deployed unchanged for real work.

After a verified encrypted local backup, copy the intended database records and
attachment bytes to the hosted staging project. Preserve original file names,
captions, references and ownership, then verify counts, hashes and authenticated
playback. Do not run demo seeding or overwrite the local CRM during this transfer.

References: [Private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[Vercel request limits](https://vercel.com/docs/functions/limitations).

## 4. Configure real administrator email verification

Sukesh's named local administrator account is active. Confirm sign-in using the
chosen private password. Local development currently uses password login;
production requires an email code before creating any administrator session.

Configure the email provider and verify delivery to the actual administrator
mailbox. The current Resend integration requires `RESEND_API_KEY` and
`AUTH_EMAIL_FROM`. A production sending domain must be owned and verified; the
website can still use a separate temporary vercel.app address. If no sending
domain has been chosen, settle email delivery before launch rather than disabling
administrator verification. Deactivate demo accounts only after successful real
administrator verification. Preserve their existing record ownership/history.

Reference: [Resend domains](https://resend.com/docs/dashboard/domains/introduction).

## 5. Configure Gemini privately

Link the Google AI Pro subscription to the owner's Google Developer profile and
check/redeem the advertised US$10 monthly GenAI/Cloud credit benefit. Verify the
credit's eligibility in the selected billing account; a subscription alone does
not make API calls unlimited or automatically configure the CRM.

Create a dedicated CRM Google Cloud/AI Studio project and API key, restrict it to
the required API where supported, and configure the paid project's billing and
spend controls. Prepay accounts need a positive prepaid balance before eligible
Cloud credits can apply. Review the checkout amount personally before funding it.
Keep `GEMINI_API_KEY` server-side; never use a NEXT_PUBLIC variable for it.

The existing Gemini feature only extracts a few fields from a PDF/image import.
It still uses a legacy SDK/hardcoded model and needs updating and budget/request
limits before live enablement. The full site-to-quotation generator remains
planned. Do not enable it by simply adding a key and assume that workflow exists.
Use approved quotation examples and rates to test output accuracy; configure the
production data terms before sending real customer information to the provider.

References: [AI Pro benefits](https://support.google.com/googleone/answer/14534406),
[developer credits](https://developers.google.com/program/plans-and-pricing),
[API keys](https://ai.google.dev/gemini-api/docs/api-key),
[billing](https://ai.google.dev/gemini-api/docs/billing).

## 6. Configure and review the Vercel staging project

Once the code and backing services are ready, use the existing GitHub review
branch and Next.js preset. Ensure the project root is the CRM repository itself.
Use the tested Node.js version (24), the package-lock file and `npm run build`.
Pick an available project name to obtain a stable vercel.app address.

Set environment variables for the appropriate staging environment: hosted
`DATABASE_URL`, `DIRECT_URL`, a fresh random `NEXTAUTH_SECRET`, the exact HTTPS
`NEXTAUTH_URL`, email configuration, Gemini configuration and the implemented
private storage adapter's settings. Do not copy localhost URLs, test email
credentials, backup encryption keys or seed credentials into Vercel.

Apply migrations through the migration connection as a deliberate release step;
do not run schema pushes, migrations or seeding on every preview build. The
`git.deploymentEnabled: false` guard stays until a concrete staging deployment is
ready for approval. Avoid merging the source PR merely to trigger deployment.

## 7. Verify staging, then approve launch

- Run the read-only deployment checks against staging configuration. Verify real
  sign-in, administrator codes, password/session revocation and demo retirement.
- Verify both companies, customer/project creation, reports, document imports,
  private downloads, group membership and upload failures/retries.
- Check upload/download URLs anonymously and confirm private CRM database tables
  cannot be accessed using Supabase browser keys.
- Test camera capture, voice playback and home-screen installation on actual
  iPhone and Android devices over HTTPS. Keep temporary-domain drafts limited to
  testing; changing the site address later creates a different browser origin.
- Configure edge rate limits, spend alerts/limits, logs and automated encrypted
  database AND file backups. Rehearse a hosted restore into a separate target.
- Review the remaining SECURITY_REVIEW.md findings before admitting real users.

A vercel.app address avoids buying a website domain immediately; it does not
remove hosting, database, email-delivery or backup requirements. No launch is
complete until the approved deployment and its configuration have been tested.
