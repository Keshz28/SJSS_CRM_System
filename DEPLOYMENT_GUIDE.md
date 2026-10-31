# Launch sjsscrm.my — 31 October 2026

The intended CRM address is **https://sjsscrm.my**. It is not live yet.
The existing domain, yldimanutd.my, was bought through Exabytes. A different
registered name is a separate domain purchase; changing DNS cannot rename it.
MYNIC's WHOIS service reported sjsscrm.my available on 31 October 2026. Availability
and checkout price must be checked again when you purchase it.

## What is already done

- Created **SJSS CRM Staging** in your **Keshz** Supabase organization, in Singapore,
  on the Free plan you authorized. Project: `egeyyqhlfulxmerexosd`.
- Installed the seven existing Prisma migrations: 18 tables including migration
  history. Enabled row-level security on every CRM table, removed browser-role
  grants, and created a restricted server role. Supabase's security advisor has
  no findings. The server role cannot log in until its private password is set.
- Created private `crm-files` and `crm-pending` buckets, each with a 50 MiB limit
  and an allowlist of the CRM's supported file types. Neither bucket is public.
- Implemented direct private uploads, server-side content validation, signed
  downloads, and the browser policy needed for private images/audio/video.
  Documents retain their 10 MiB limit; site media retains its 50 MiB limit.
- Added configuration, transfer, cleanup and deployment-check scripts. They do
  not run automatically on a Vercel build. Cloud transfer and live Storage tests
  are pending the private credentials below.
- Created an encrypted local backup and successfully restored all 18 tables and
  all three attachments into an isolated temporary database. Local records remain
  the source of truth; no customer records have been copied into the cloud yet.
- Generated a fresh session-signing secret in the ignored, private `.env.launch`
  file. The local `.env` still points to the local database.
- Patched the validation dependency; the production dependency audit has zero
  advisories. Local test results are recorded in SECURITY_REVIEW.md.

Database dashboard:
https://supabase.com/dashboard/project/egeyyqhlfulxmerexosd

## Your steps, in order

These steps require your account sign-in, private credentials, payment or device.
You do not need to write SQL, run migrations, upload source code or configure the
application yourself. Tell me when each account step is done and I can continue.

### 1. Buy sjsscrm.my from Exabytes

1. Open https://billing.exabytes.my/mypanel/ and sign in to the account you used
   for yldimanutd.my.
2. Open **Domains → Domain Search / Register a New Domain**. Alternatively use
   https://www.exabytes.my/domains/domain-name-search.
3. Search for **sjsscrm.my**, select it if still available, and add it to your cart.
4. Choose the registration period, check both first-year and renewal prices,
   enter the requested registrant details and complete payment.
5. Complete any domain/contact verification requested by Exabytes.
6. Tell me **“sjsscrm.my purchased.”**

Only domain registration is needed from Exabytes for this setup. Vercel hosts the
CRM and supplies HTTPS, so additional Exabytes web hosting or paid SSL is not
needed. Keep yldimanutd.my as it is unless you separately decide to stop renewing it.

### 2. Restore Vercel access and choose the hosting plan

1. Connect the Vercel integration offered in this conversation, using the account
   that owns your existing projects/domain. The saved CLI login has expired.
2. If that does not provide deployment/DNS access, open your IDE terminal and run
   **`vercel login`**, then finish the browser sign-in. Tell me when it succeeds.
   This command only signs you in; it does not publish the CRM.
3. In Vercel, select the team/account that will own this business CRM. In
   **Settings → Billing**, review **Pro**, currently starting at **US$20/month**
   for one developer seat, and complete checkout if you accept the price.
4. Tell me which Vercel team you selected. I will link the correct project,
   configure the deployment and domain, and avoid publishing incomplete settings.

Your CRM staff use CRM accounts; they do not each need a Vercel developer seat.
Vercel's Hobby plan is limited to personal, noncommercial use.

### 3. Supply the two private Supabase settings

1. Open the database dashboard linked above. Select **SJSS CRM Staging**, not the
   older inactive “Keshz28's Project.”
2. Open **Project Settings → Database** and set/reset the database password for
   this new project. Store it in your password manager. A long generated password
   using letters and numbers avoids URL-encoding mistakes.
3. Click **Connect**, select **Session pooler**, then copy its PostgreSQL URI.
   Replace its password placeholder with the password you just set. The Session
   pooler uses port **5432**; do not choose Transaction pooler for this step.
4. Open `.env.launch` in the CRM folder in your IDE. Paste that complete URI
   between the quotes after **DIRECT_URL=**. Leave DATABASE_URL empty; I will
   generate and verify a separate restricted runtime connection.
5. In Supabase, open **Project Settings → API Keys → Secret keys**. Copy/create a
   server secret key and paste it between the quotes after **SUPABASE_SECRET_KEY=**
   in `.env.launch`. Do not choose the publishable/anon key.
6. Save the file and tell me **“Supabase settings saved.”**

Never paste these values into chat, screenshots, GitHub or a browser-facing
NEXT_PUBLIC variable. `.env.launch` is already excluded from Git and readable
only by your local account. I cannot retrieve your database password or server
secret key through the connected Supabase tools.

### 4. Set up the email account for administrator sign-in

1. Sign in/create your account at https://resend.com/.
2. Open **Domains → Add domain**, enter **auth.sjsscrm.my**, and keep the displayed
   DNS verification records available. Domain verification can finish after step 5.
3. In **API Keys**, create a key named **SJSS CRM**, with **Sending access**, scoped
   to this sending domain when available.
4. Paste the key privately into **RESEND_API_KEY=** in `.env.launch` and save it.
   The sender is already prepared as `SJSS CRM <login@auth.sjsscrm.my>`.
5. Tell me the key is saved. The DNS records Resend displays are public records,
   so you can share their record types, names, values and priorities here if I
   cannot read them through an authenticated account connection.

An ordinary Gmail address can receive your login codes. You do not need to buy a
mailbox for the sender address. Production administrators must receive and enter
an email code; the app will not bypass this when the email service is missing.

### 5. Point the NEW domain's DNS to Vercel

Do this after I have added sjsscrm.my to the correct Vercel account and supplied
its exact assigned nameservers.

1. In Exabytes, open **Domains → My Domains → sjsscrm.my → Manage → Nameservers**.
2. Choose custom nameservers and replace the defaults with the exact nameservers
   provided for this domain in Vercel. Save.
3. Tell me **“New domain nameservers updated.”** DNS propagation can take time.

I will check propagation, set the required website and email DNS records in
Vercel, verify HTTPS, and set the CRM's final sign-in URL. The old yldimanutd.my
already uses Vercel nameservers; that does not configure the newly purchased name.
Do not copy guessed A/CNAME values or change the old domain to point to the CRM.
If your new domain already has email/other DNS records, they must be copied to
Vercel before changing its nameservers.

### 6. Choose production database/backup billing

The database is currently Free for preparation. Before it holds the live business
records, I recommend upgrading the Keshz organization to **Supabase Pro**, currently
starting at **US$25/month**, with one Micro project covered by its compute credit.
Use **Organization → Billing** to review the actual estimate and checkout.

The recommended base is therefore **US$45/month** for Vercel Pro plus Supabase Pro.
Domain registration, taxes, exchange conversion, extra usage, extra running
projects and independent backup storage are separate. Resend can start on its
Free tier within its current limits. No paid subscriptions have been purchased
by the agent. Review spend controls and alerts when choosing these plans.

Supabase's database backups do **not** include the attachment bytes in Storage.
I will configure and rehearse the database AND file backup process once cloud
credentials and the destination/account are available. A Free database and a copy
on your laptop are not the complete ongoing production backup arrangement.

### 7. Perform the personal acceptance checks when I send the staging link

1. Sign in with your real administrator account and receive/enter the email code.
2. On your actual phone, create a test customer/site visit, upload a photo and
   record/play a voice note. Close and reopen the CRM and confirm the records remain.
3. Check the two companies and one document download. Sign out and confirm the
   private document route requires sign-in again.
4. Tell me the result. I will retire the demo users after your verified real
   administrator sign-in, complete launch checks, and publish the final release.

## Work for the agent after your account steps

This is the technical handoff, not a list of commands the owner has to run.

1. Verify `.env.launch` privately. `npm run cloud:configure` applies the restricted
   role grants and generates its password/pooled DATABASE_URL. Test actual CRUD
   and blocked DDL with that login. Keep the privileged DIRECT_URL local.
2. Verify Prisma migration status/checksums against the hosted schema. The initial
   MCP bootstrap recorded the exact seven migration checksums. Reapply
   `scripts/cloud-hardening.sql` after future schema changes. Never `db push` live.
3. Pause local writers, take/rehearse a fresh encrypted backup, then run
   `npm run cloud:transfer`. It refuses a nonempty destination, copies all 15
   business tables in a transaction, omits login challenges/throttle counters,
   revokes copied sessions, copies unique private files and verifies byte hashes.
   It preserves local data. Verify counts, relationships and runtime reads.
4. Test actual signed Storage uploads (including >4.5 MB), private downloads,
   range playback, failed/retried uploads, and expired/forged tokens. The current
   automated cloud adapter tests use mocked Storage; live Storage is still pending.
5. Link Vercel to the reviewed source. Use Node 24 and npm run build, Singapore
   functions, and a stable protected staging URL. Configure NEXTAUTH_URL to that
   exact staging origin during testing. Deploy deliberately; Git autodeploy is
   disabled in vercel.json until the complete release is ready.
6. Set server-only environment variables from `.env.launch`. Exclude seed
   passwords, backup keys and the privileged migration DIRECT_URL. If DIRECT_URL
   is required for schema parsing on Vercel, supply the restricted runtime URI
   there, never the administrative migration credential. Production and staging
   settings must not be mixed with localhost or share live customer data casually.
7. Verify Resend DNS/domain and real administrator delivery. Configure login,
   email-challenge and upload edge rate limits, monitoring and spend alerts.
8. Schedule `npm run storage:cleanup` daily on a trusted runner with protected
   environment credentials; it deletes only pending objects older than 24 hours.
   Configure encrypted, independent database-and-file backups, retention, offsite
   access controls and a separate-target restore rehearsal. These are still pending.
9. Retire demo accounts after real verified sign-in, run npm run cloud:check,
   complete the hosted tests in SECURITY_REVIEW.md and publish sjsscrm.my. Keep
   the local copy and an encrypted cutover backup until the hosted copy is verified.
10. Keep Gemini disabled for the first launch. Its API billing, data handling and
    separate request quota can be configured later; the core CRM does not require it.

## References checked for this plan

- [Exabytes domain search](https://www.exabytes.my/domains/domain-name-search)
- [Vercel pricing](https://vercel.com/pricing) and [Hobby limits](https://vercel.com/docs/plans/hobby)
- [Vercel domain setup](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Vercel nameservers](https://vercel.com/docs/domains/working-with-nameservers)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Prisma setup](https://supabase.com/docs/guides/database/prisma)
- [Supabase Storage](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
