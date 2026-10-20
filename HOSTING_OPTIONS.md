# Hosting proposal — prices checked 17 October 2026

This is a recommendation for review. No domain, subscription, hosted database or
email service has been purchased or provisioned. Prices below are in USD; card
conversion to MYR, taxes, extra usage and domain registration/renewal are separate.

On 19 October the owner deferred domain/hosting selection and requested that local
preparation continue. No provider-specific cloud migration or purchase is approved.
Domain registration and recurring app/database hosting are separate costs.

On 20 October the owner selected Vercel and Gemini and requested guided setup.
Provider accounts/projects have not yet been created. Supabase remains the
recommended database/private-file service; its plan and any purchases still need
to be chosen. Follow DEPLOYMENT_GUIDE.md and the current step in chat. The earlier
hold on automatic deployments remains until the app and external configuration
are ready to review.

The repository has historical Vercel deployments. `vercel.json` disables automatic
Git-triggered Vercel deployments for the reviewed source until hosting is ready.
Before a deliberate launch, review this guard alongside the remaining security,
email and private storage requirements. It does not take any existing deployment
offline or prevent someone from deploying manually.

## Recommended: managed website, database and private object storage

| Component | Purpose | Starting monthly cost |
| --- | --- | --- |
| [Vercel Pro](https://vercel.com/pricing) | Next.js website and API; one developer seat | $20 |
| [Supabase Pro](https://supabase.com/pricing) | PostgreSQL and private files in one project | $25 |
| [Resend Free](https://resend.com/pricing) | Sign-in verification email | $0 within 3,000 emails/month and 100/day |
| Baseline total | One CRM deployment serving both companies | **$45/month** |

The Vercel developer seat is for managing deployments. Your dad and approved CRM
users do not each need a Vercel developer seat. The Hobby plan is for personal,
noncommercial use; this proposal uses Pro for the business CRM.

Supabase Pro includes an 8 GB database, 100 GB file storage and 250 GB egress,
with additional usage charged separately. Both companies can share one database
project under the approved shared-CRM access policy. Configure both service
accounts with spend alerts/limits and keep administrative keys on the server.

This option reduces operating-system/database maintenance. Place the website and
database near each other, preferably in a region suitable for Malaysian users,
after checking the selected providers' regional availability.

### Required work before using this option

- Replace local-disk uploads with private Supabase object storage. Authorize
  uploads/downloads through the CRM and use short-lived upload/download URLs.
  Preserve file type/size checks, ownership, idempotent retries and private access.
  Vercel Functions have a [4.5 MB request/response body limit](https://vercel.com/docs/functions/limitations),
  so the current 10 MB document / 50 MB media workflow cannot be deployed unchanged.
- Configure Prisma connection pooling and the migration connection; transfer a
  deliberate copy of the local database and files after checking the real accounts.
- Supabase provides daily database backups with seven-day retention on Pro, but
  [database backups do not include Storage objects](https://supabase.com/docs/guides/platform/backups).
  Arrange a separate encrypted file backup and a restore rehearsal. Backup storage
  costs depend on data size/provider and are not included in the $45 baseline.
- Apply edge source-IP limits for login, email-code requests and uploads. Confirm
  cookie security, HTTPS, real-device capture/playback and mail delivery on staging.
- Choose a domain, set the CRM URL and [verify an email-sending domain in Resend](https://resend.com/docs/dashboard/domains/introduction).
  An address on your own domain sends codes; your existing Gmail address can receive them.

## Lower subscription cost: a self-managed server

A [DigitalOcean Basic Droplet](https://www.digitalocean.com/pricing/droplets) with
4 GiB RAM / 2 vCPUs starts at $24/month. Its optional [daily image backups](https://docs.digitalocean.com/products/backups/details/pricing/)
add 30%, making a **$31.20/month server-plus-image-backup baseline**. Domain,
independent encrypted database/file backups, extra storage and usage are separate;
Resend can still start on its free tier.

The current app and private filesystem storage fit this deployment model, but
someone must maintain Linux, firewall rules, TLS renewal, PostgreSQL, monitoring,
disk capacity, security patches and restore procedures. Database-consistent
logical backups are still needed; a server image alone is not the complete plan.

For this CRM's customer records and your dad's daily work, the managed $45 option
is my preferred starting point if its budget is acceptable. The decision to spend
money or deploy remains pending and will be discussed in chat.
