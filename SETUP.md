# SJSS CRM — Setup Guide

## Development database

This checkout uses PostgreSQL 17 locally. Supabase also runs PostgreSQL, so the
existing Prisma schema can be used with Supabase when configuring hosting.
This is a fresh development database; it does not contain data from any previous
Supabase project.

- Database: `sjss_crm`
- Application database user: `sjss_crm`
- Address: `127.0.0.1:5433`
- Database files: `.local/postgres/` (ignored by Git)
- Server log: `.local/postgres.log` (ignored by Git)
- Connection strings and authentication secret: `.env` (ignored by Git)

The local server listens only on `127.0.0.1`. TCP connections require a password.
Its Unix socket is inside the private `.local` folder.

## Start this checkout on macOS

Run commands from the `SJSS_CRM_System` folder.

If the database is stopped, start it:

```bash
"$(brew --prefix postgresql@17)/bin/pg_ctl" -D .local/postgres -l .local/postgres.log -w start
```

Then start the CRM:

```bash
npm run dev
```

Open **http://localhost:3000**.

To check or stop the database:

```bash
"$(brew --prefix postgresql@17)/bin/pg_ctl" -D .local/postgres status
"$(brew --prefix postgresql@17)/bin/pg_ctl" -D .local/postgres -m fast -w stop
```

The database is not registered to start automatically at login. Its data remains
in `.local/postgres` when stopped. Do not delete this directory to clear logs.

## Initial setup for another checkout

Use Node.js 24 (the version tested for this checkout) and PostgreSQL, then create a dedicated PostgreSQL login and a
database owned by that login. For Supabase, use the project's database connection
settings instead.

```bash
npm ci
cp .env.example .env
```

Edit `.env`:

- Set `DATABASE_URL` to the application database connection string.
- Set `DIRECT_URL` to the connection used by Prisma schema commands. For local
  PostgreSQL both URLs are identical. Adjust host, port, user, password and
  database name to match your server; the example uses this checkout's port 5433.
- Set `NEXTAUTH_URL` to the app address (`http://localhost:3000` for development).
- Generate `NEXTAUTH_SECRET` with `openssl rand -hex 32` and paste the result.
- Set `GEMINI_API_KEY` only if using AI quotation extraction.

Use `.env` so both Next.js and Prisma CLI commands load the same settings. Do not
commit this file or copy real credentials into `.env.example`.

For a **new, empty development database**, create the tables and seed accounts:

```bash
npm run db:migrate
SEED_DEMO_DATA=true npx prisma db seed
```

`db:migrate` applies the checked-in migration history. The first migration creates
an empty database's original CRM schema; the second adds Projects and capture
metadata; the third assigns customers to individual companies; the fourth adds
personal project pins/stars and restorable project deletion; the fifth adds
company-specific work groups, memberships and messages; the sixth adds persistent
login throttling and atomic invoice sequences; the seventh adds administrator
email-code challenges and the last verified-email timestamp. This Mac's
original database has already been baselined and migrated.
For another existing database, compare its schema and take a backup before
baselining; do not mark migrations applied without verifying the schema matches.
`db:push` remains available for disposable schema experiments only.

The explicit local demo seed adds two companies, one sample customer and these development accounts:

| Account | Email | Password |
|---------|-------|----------|
| Administrator | admin@sjss.com | admin123 |
| Staff (1–4) | user1@sjss.com through user4@sjss.com | user123 |

Change these passwords before using the CRM with real business data.
Production/bootstrap seeding instead requires `SEED_ADMIN_EMAIL` and a strong
`SEED_ADMIN_PASSWORD`; it creates no demo staff or sample customer and does not
overwrite existing passwords. Never pass secrets in shell history. Keep them in
the hosting secret manager or an ignored environment file.

Read [SECURITY_REVIEW.md](SECURITY_REVIEW.md) before deployment. Run
`npm run security:check` against the intended deployment environment. The local
checkout intentionally fails that check until its demo accounts, domain and
durable storage configuration have been replaced.

## Connecting Supabase later

Follow the [official Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma)
to choose connection strings appropriate to the deployment network and pooling
mode. Configure `DATABASE_URL` and `DIRECT_URL` in the hosting environment rather
than committing them. Follow the connection settings for the project's existing
Prisma version; do not copy a newer Prisma configuration format into this app.

Changing these URLs connects the app to a different database; it does not transfer
local data. Back up and deliberately migrate any data that needs to be retained.
Do not run the development seed against an existing business database blindly.

## Administrator email verification and account changeover

Administrators sign in with their password and a six-digit email code in
production. Codes expire in ten minutes and work once. Five wrong codes lock the
challenge, and sending is limited to five emails per account per hour with a
one-minute resend cooldown. Code hashes include a server-side secret and are
bound to the account and password-reset version. No fallback administrator
session is created when delivery fails. Standard approved users retain password
login; changing a user to administrator requires fresh verification.

Configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` using the hosting secret manager.
The sender must use a domain verified with Resend. An administrator can receive
codes at Gmail or another existing address; the sending address is separate.
Production always requires codes. Local development keeps password login until
`ADMIN_EMAIL_VERIFICATION=true` is explicitly enabled.

To replace demo accounts without losing access:

1. Prepare the named administrator account inactive. In Manage Users, its key
   button opens **Set password and activate**; choose a private strong password.
2. Configure the sender and email service. Enable local verification only after
   the named administrator is active and has a password.
3. Complete a sign-in with the named administrator using a real delivered code.
4. Use **Deactivate demo accounts** in Manage Users. This action preserves saved
   records and revokes the demo sessions; it requires a verified real administrator.

Keep passwords/API keys out of chat and Git. A fresh production authentication
secret should be generated before launch. Domain selection and live email setup
are still pending; no real email was sent during implementation tests.

## Useful commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development app |
| `npm run build` | Generate Prisma client and build the app |
| `npm start` | Run an existing production build |
| `npm run lint` | Check ESLint rules |
| `npx tsc --noEmit` | Check TypeScript |
| `npm run db:studio` | Inspect the configured database in Prisma Studio |
| `npm run db:push` | Apply the Prisma schema directly |
| `npx prisma db seed` | Load `.env` and run the development seed |

## Backups

With the local database running, create a backup (the password is in `.env`):

```bash
"$(brew --prefix postgresql@17)/bin/pg_dump" -h 127.0.0.1 -p 5433 -U sjss_crm -W -Fc -f .local/sjss_crm.backup sjss_crm
```

Copy backups to a separate safe location. New uploaded attachments live under
`.local/uploads/` by default; back up that folder alongside database backups.
Set `UPLOAD_DIR` to an absolute persistent directory for a self-hosted server.
Do not use temporary serverless filesystem storage for a live deployment.

### Encrypted complete local backups

For this checkout, prefer the complete backup command over a database-only dump:

```bash
npm run backup:create
```

It snapshots the local database and every referenced private attachment into an
encrypted `.local/backups/<timestamp>.sjss-backup/` directory. It briefly blocks
database writes to keep the database and files consistent; if another write or
migration is in progress, it fails rather than waiting. Missing or changed files
make the backup fail. Run it when no one is editing. Unreferenced/orphan files,
browser drafts, environment secrets and source code are not included.

The first run creates `.local/backup.key` with private permissions. Each file uses
AES-256-GCM authenticated encryption with a random nonce. The manifest and database
dump are also encrypted. Keep the key separately from an off-device copy of the
backup; losing the key makes those backups unusable. Existing database-only
`.backup` files remain unencrypted; these commands do not retroactively encrypt
or delete them. `BACKUP_KEY_FILE` can select an existing private 32-byte key file.

Rehearse restoration using the directory printed by the create command:

```bash
npm run backup:verify -- ".local/backups/<timestamp>.sjss-backup"
```

This decrypts into a private temporary directory, starts a separate PostgreSQL
instance reachable only through its private Unix socket, restores the database,
compares every table's row count and checks every attachment's SHA-256 hash,
size and restored database reference. It stops and removes the temporary instance
after the check. **It never restores over the CRM database.** A failed authentication
or integrity check prevents a successful rehearsal.

PostgreSQL 17 command-line tools must be installed (`PG_BIN` can locate them).
These commands are for the local Mac/Linux checkout; production scheduling,
off-device storage, retention and recovery procedures must be configured with
the selected hosting provider. A local copy on the same laptop is not disaster
recovery. Temporary plaintext is removed on normal completion/error; a machine
crash may leave a private temporary directory requiring cleanup.

### Draft privacy on shared devices

Settings → **Privacy on this device** → **Clear my device drafts** removes the
signed-in account's unfinished captures and group-message drafts from that browser
after confirmation. It preserves saved server records and other accounts' drafts.
Other open capture/chat tabs reload, and stale autosaves are rejected.

Signing out checks for device drafts and offers **Clear drafts and sign out**,
**Keep drafts and sign out**, or **Cancel**. Keeping drafts is intended for the
user's own locked device; they remain unencrypted in browser storage. If cleanup
fails, the UI reports it and allows retry or explicit sign-out with drafts retained.
Session expiry or closing the browser does not automatically clear drafts.

## Existing quotation imports

The current import screen accepts one original Excel, Word, PDF or JPG/PNG file
up to 10 MB, with manually reviewed metadata. Excel/Word contents are not yet
read into individual line items. Imports default to Draft; explicitly select
the historical status where known. Amounts must be nonnegative, fit the database
range and have at most two decimal places. Dates must be real calendar dates.

File validation happens before any financial record is saved. Customer, number
sequence, quotation, summary item and attachment commit in one transaction;
failed transactions clean up their staged file. Batch metadata imports use one
transaction per row and report failed row indices. PDF/image autofill validates
its suggestions and cannot overwrite a replacement document with a late response.

`DOCUMENT_IMPORT_PLAN.md` distinguishes these implemented checks from the planned
bulk workbook reader and separate invoice records. `AI_QUOTATION_PLAN.md` describes
the proposed draft/edit/approve workflow; AI quotation generation is not yet built.

## Work groups

Open **Communication → Work groups**, or choose Work groups from the Inbox page.
Administrators create groups, choose active members and optionally link an active
project from the same company. A group belongs to one company permanently; the
global company selection filters the list. Only members can read or send, including
administrators: an administrator is not automatically a member of every group.

Members can send text and read the group's previous history. Administrator members
can post **Official announcements**, which also have a separate Announcements
view, and edit group details/membership. Removal revokes subsequent read/send
access. Membership changes and sends are serialized in database transactions.
Project deletion preserves group history and hides its unavailable project link.

Chat updates every three seconds while its page is visible. History loads in
50-message cursor pages; group lists use 20 groups per page. Retry keys prevent
duplicate sends, including a lost response after the server committed a message.
Unsent text drafts stay on the device under the signed-in account/group key where
browser storage is available; they are not synced between devices. Public service
worker caches do not store messages. Server endpoints recheck membership for
every request. All text is rendered as text, not HTML.

This version uses the CRM's own authenticated API and PostgreSQL database, with
no external chat service or WhatsApp integration. It provides text chat; photos
and voice recordings remain in the project's Site Updates workflow. Background
phone push alerts, read receipts, presence indicators and message attachments are
not part of this release. Messages appear when opening the group; they do not
currently create separate inbox/bell notifications. Normal application hosting,
database storage and backups are still needed for shared mobile use.


## Projects and mobile capture

Customers belong to one CRM company. New customers must select that company;
they count on its dashboard immediately, even without a quotation or project.
"All companies" combines the two company views. The same client can have a
separate customer record in each company, with independent details and history.
Customer pickers, imports, site visits, projects and quotations enforce this
relationship. A new project's **Add new customer** option saves the customer and
project together; a failed project transaction does not leave an orphan customer.

The customer-company migration infers ownership from existing business records.
Where a customer had records in both companies, it preserves them as independent
customer records and relinks each company's history. Customers with no known
company remain marked **Company not assigned** in the combined customer list;
edit those records to assign them. This checkout's sample ABC Trading customer
was explicitly assigned to SJ Sunrise Services.

Open **http://localhost:3000/projects**, create a project, then choose **Capture
update**. Add photos/video, a caption under each item, and optional voice notes.
Updates remain in the project when you create a quotation from them. Both iPhone
and Android are platform targets; physical-device verification is still required.

The Site Visits page defaults to compact rows with small media previews, project,
customer, location, status, date and file count. Gallery is an optional display.
Visits are shown newest first, 20 per page, with Previous/Next navigation so
older visits remain accessible beyond the former 60-record limit. Search also
matches project names; Captured/Quoted filters, company scope and display choice
are preserved during pagination. New searches start at page one. Voice and video
previews use icons; failed image previews fall back to an icon.

Each visit has a **Back to site visits** link that goes directly to the list.
Visits opened from that list retain its search, status, display and page, even
after reloading or adding media. The linked job is available separately through
**Open project**. Direct visit links fall back to the main Site Visits list.

Projects have **Pin**, **Star** and **Delete** controls in their cards and workspace.
Pins sort first, stars next, followed by the latest updated projects; sorting is
applied before pagination. Pins and stars belong to the signed-in user and sync
across that account's devices. Visible section tabs offer All projects, Pinned,
Starred and Recently deleted. Switching sections keeps the company/search/stage
filters and starts at the first page. Searches stay within the current section.

Delete is available only to the creator or an administrator. It moves the
project to Recently deleted, hiding its site updates from active capture/list
workflows. Its updates, files and personal preferences are retained for Restore;
quotations stay available. Deleted projects cannot accept new updates, media or
edits. There is no automatic permanent deletion in this release. The creator or
an administrator can restore the project from Recently deleted.
Confirmed delete/restore operations reload the current filtered list so cards
and totals update together; failed requests leave the project visible for retry.

The camera button uses a file input with `capture="environment"`, asking the
phone/browser for a rear-facing camera capture. The OS can offer its camera
screen or a chooser; confirming a photo/video returns that file to the capture
form. **Save update** uploads the selected media to its project. Desktop browsers
usually open a file picker instead. Home-screen installation happens on the
device where the website is opened, after confirming the browser installation
or iPhone's Add to Home Screen steps; it does not install remotely onto a phone.

Capture drafts (including blobs) are saved in IndexedDB under the signed-in user
and project/update context. Opened capture screens can retain work through network
interruptions. Reopen the same capture screen after reconnecting to restore the
draft, then tap **Save update** to continue uploading. Stable request/upload IDs
prevent retries from creating duplicate records. Uploaded items are skipped on
retry. Device storage can be cleared by the OS/user; it is not a server backup.

Installation assets, iOS guidance and a public offline fallback are included.
The service worker caches only public installation assets, never authenticated
HTML, API responses or uploaded media. Loading a new page while offline shows the
fallback until reconnection; this release does not provide a full offline project
browser or guaranteed background upload.

For real phones, use an HTTPS deployment reachable from the device. The Mac's
localhost is not the phone's localhost. Microphone permission is required. Keep
recording on-screen and stop it before saving. Recordings stop on page hiding
where the browser permits and have a three-minute limit. Audio formats are
selected using both recording and playback support detection, with explicit
AAC/MP4 or Opus/WebM/Ogg codecs. Test recording and playback in a regular Chrome
or Safari window: VS Code's embedded preview has limited media codec support and
may show a disabled player for an otherwise valid saved recording. Failed players
show an explanation and a retry button; existing recordings are kept unchanged.

## Private files and legacy uploads

New uploads are stored outside `public` and served through a session-protected
route with range support for audio/video. Direct `/uploads/...` URLs are blocked.
Existing records can still be viewed through the authenticated viewer before
migration. After taking a backup, move their files into private storage with:

```bash
npm run files:migrate
```

The script updates all references to each file before removing its public copy.
Back up any legacy `public/uploads` files until migration completes. File deletion
checks remaining references so a quotation copy does not lose its media when an
original visit attachment is removed.

## Regression tests

The PDF content checks use PDF.js as a development dependency and require
Node.js 22.13 or later (Node.js 24 is used in this checkout).

Use a running **local development/test database**, seeded administrator and app
server. Tests create and remove temporary records, and consume quotation numbers.
They refuse a non-local base URL. Configure `CRM_TEST_EMAIL` and `CRM_TEST_PASSWORD`
if using a different local administrator; defaults are the seeded development
account. They do not send messages.

```bash
npx playwright install chromium
npm run test:e2e
npm run typecheck
npm run lint
npm run build
```

For the temporary test browser downloaded during this setup:

```bash
npm run build
# Separate terminal: production build, localhost only, fake email transport.
npm run test:server
# In the test terminal:
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/sjss-crm-browsers npm run test:e2e
```

The test server checks that both the application and database addresses are local.
Only it preloads the fake mail transport; production application code has no fake
mail mode. Tests read codes from the ignored private `.local/test-email-outbox/`
and exercise the real sign-in endpoint. Tests of code throttling do not disable
the protections being tested. Never use `test:server` for actual hosting.

Tests cover session revocation, role refresh, private files, file ranges, upload
retry, conversion, PDFs, mobile drafts, offline retention, simulated microphone
recording with actual playback before/after saving and reloading, audio format
fallback and retry, permission cancellation/denial, installation assets and existing pages.
Use `CRM_TEST_BROWSER=chrome` to opt into an installed Chrome instead of the
matching bundled test browser.

Company tests cover combined/per-company customer counts without business
history, inline project customers, company-specific dropdowns and record lists,
API filtering and rejection of cross-company links, and independent import
matching. Report checks read the actual text of all nine scope/period PDFs and
compare names and accepted values with the on-screen summaries. Calendar tests
cover Malaysia month/week/year boundaries and monetary rounding.

Report summaries cover all time; charts show 12 weeks, 12 months or 5 years in
Malaysia time. Accepted quotation value is not a payment or cash-revenue ledger.
PDF exports retain the company shown on the report even if another browser tab
changes the global company selection.

## Interface colours

The interface uses navy navigation, blue actions and a light background by
default. The header theme button still offers dark mode, and a saved choice is
retained when navigating or reloading. New sessions start in light mode.

Shared colours are defined in `app/globals.css`, with RGB channel mappings in
`tailwind.config.ts` so translucent borders, badges and surfaces work in both
themes. Text accents and button backgrounds use separate tokens to keep white
button labels readable in dark mode. Charts, report PDFs, login and quotation
import use the updated palette. Import fields stack on
phones, and keyboard focus is visible across shared controls.

## Brand logo and app icons

The supplied gold artwork is preserved in `public/brand/sj-sunrise-logo.png`.
`BrandLogo` displays it beside SJSS CRM in the sidebar and on the login screen,
including the mobile navigation drawer. Its white background is retained in
both themes. This is shared app branding; individual company records and
quotation branding remain separate.

The manifest, browser tab and Apple home-screen icon use PNG sizes generated
from the complete original. Regenerate with `node scripts/generate-brand-icons.mjs`
after replacing that source. The dedicated Android maskable icon pads the full
artwork into the safe circle so launchers cannot crop the wording. No text or
details have been redrawn. Icon filenames and the public service-worker cache
were updated to avoid serving the previous S mark. Existing installed apps may
need time to refresh their icon, or removal and installation again.

## Deployment work still remaining

Local filesystem storage must be replaced with a durable private object store (or
backed-up persistent server disk) for hosting. Per-project team assignments,
company membership restrictions, full offline browsing/background synchronization,
physical iPhone/Android testing, tasks/reminders and proper financial records are
separate follow-up work. Per the owner's access decision, current CRM records
remain shared among users individually approved by an administrator;
project metadata edits and deletion/caption controls have creator/admin checks.

The framework/authentication upgrade and patched PostCSS resolution removed the
production dependency findings: `npm audit --omit=dev` reported zero on 16 October
2026. The full audit still reports nine development dependency entries (seven
high, two moderate) in the Tailwind 3/ESLint toolchain. Those need a separate
compatible tooling update. Re-run both audits before deployment.
