# Launch preparation update — 31 October 2026

Current status: hosted staging schema prepared; CRM is **not live**. See
DEPLOYMENT_GUIDE.md for the current launch steps and remaining account work.

- Singapore Supabase project `egeyyqhlfulxmerexosd`: seven Prisma migrations,
  18 tables with RLS, no anon/authenticated/PUBLIC table grants, restricted
  `crm_runtime` role (NOLOGIN until credentials are configured), and two private
  50 MiB buckets. Supabase security advisor: no findings.
- Cloud file adapter: authenticated signed staging uploads, 15-minute user/purpose/
  metadata-bound finalization tickets, 60 upload preparations per user per 15
  minutes, content/size validation, immutable permanent copies, and 5-minute
  signed reads after a fresh CRM session check. Signed read URLs are bearer
  capabilities valid until expiry; sign-out does not revoke an already issued URL.
  Existing shared-CRM read access is preserved. No browser Storage policies.
- Abandoned staging cleanup script is prepared; scheduling is pending. Live
  Storage validation, hosted transfer, edge limits, email delivery and automated
  offsite database AND file backup/restore tests are still pending credentials.
- Zod upgraded to 4.6.7 for GHSA-mrhx-c7xc-m3w5. Production dependency audit:
  zero findings. Full dependency tree still reports 19 moderate development/tool
  findings; do not describe the whole dependency tree as vulnerability-free.
- Encrypted local backup `.local/backups/2026-10-31T05-20-02-101Z-0a6ce547.sjss-backup`
  restored successfully into an isolated temporary database: all 18 table counts
  match and all three attachments pass authentication/hash checks.
- Production build and typecheck passed. All 35 selected CRM regression tests
  passed, including browser checks in installed Chrome. Eight focused storage, token, streaming,
  monetary calculation, reporting and backup tests passed. Cloud Storage tests use
  mocks; they are not a substitute for the pending real cloud smoke test.

Historical review and earlier test results follow. Statements about deferred
hosting or unfinished cloud-upload implementation below are historical; this
update and DEPLOYMENT_GUIDE.md describe the current state.

---

# Pre-deployment review — updated 20 October 2026

**Deployment decision: hold.** The code review found and addressed concrete
issues, but real accounts and hosting controls below still
need to be settled. Local tests cannot certify a future hosting configuration.

## Changes made during this review

| Area | Finding and correction |
| --- | --- |
| Login guessing | Added a PostgreSQL-backed counter: ten attempts per normalized email per 15-minute window. Counters work across server restarts/instances and store keyed hashes, not email addresses. Successful sign-in clears the counter. Hosting must also limit source-IP traffic to prevent password spraying and account-lockout abuse. |
| Passwords | New accounts/resets require at least 15 characters and at most 72 UTF-8 bytes. The byte limit prevents bcrypt silently truncating passwords. Existing accounts remain usable locally and must be reviewed before deployment. Password creation/reset inputs are masked. |
| Sessions | Sessions use HttpOnly NextAuth cookies, eight-hour expiry, current role/active-status checks, and password-reset versioning. Deactivation now increments the version so reactivating an account does not revive an old stolen cookie. |
| Administrator email verification | Added password plus a six-digit email code before any administrator production session is created. Codes expire after ten minutes, are single-use, bound to account and session version, and stored as keyed hashes. Five guesses, a resend cooldown and a five-email/hour send quota limit abuse. No delivery failure bypasses verification. Role elevation requires administrator verification; old sessions without proof are rejected. |
| Administration | There is no public signup. Account creation, roles, password resets and company settings require administrator permission on the server. Administrator mutations now serialize and recheck the actor, preventing simultaneous administrators from deactivating each other and locking everyone out. Duplicate email creation returns a conflict. |
| Cross-site requests | Middleware rejects foreign/null origins and foreign browser fetch metadata on mutation requests, including sibling subdomains. NextAuth retains its own CSRF validation for authentication. |
| Browser isolation | Added per-request nonce CSP, anti-framing, MIME sniffing protection, referrer policy and camera/microphone permissions scoped to this app. The production policy does not permit script unsafe-eval. HTTPS deployments enable HSTS and insecure-request upgrading. API responses are private/no-store. |
| Request validation | Streamed body readers bound JSON and multipart uploads, including chunked bodies; invalid JSON returns validation errors. Auth bodies are limited to 16 KiB, ordinary JSON to 1 MiB, document forms to 11 MiB and site-media forms to 51 MiB, with smaller per-file limits still enforced. The hosting proxy must apply limits before buffering. Pagination and quotation status inputs no longer produce invalid database queries. |
| Record changes | Quotation/site-update editing and conversion, invoice creation and file additions now require the record creator or an administrator. Existing project/media delete checks are retained. Direct edit URLs also enforce the checks. Approved users share customer management under the access policy below. |
| Financial integrity | Quotes validate amounts, precision, dates, line count and database ranges; totals use decimal arithmetic and sum rounded lines. Invoice creation locks the quote, uses an atomic yearly sequence and returns the existing invoice on retry. Quotation numbering also advances beyond imported historical references. Neither counter is rewound by record deletion. |
| File storage | Uploads remain private, authenticated and type/size checked, with path traversal checks, sandboxed downloads and byte-range support for recordings. Storage errors no longer return filesystem paths to clients. No legacy uploaded files remain under public/uploads (only empty directories). File validation is not malware scanning. |
| Local recovery | Added authenticated encrypted backups covering the database and every referenced private file. Backups briefly lock writes and use one exported database snapshot. A separate temporary PostgreSQL instance rehearses restoration, checks all table counts and verifies attachment hashes, sizes and references without restoring over the application database. Keys are stored separately with private permissions. |
| Device drafts | Added confirmed account-specific draft cleanup in Settings and a keep/clear choice when signing out. Other open capture/chat tabs reload after cleanup; revision checks reject stale autosaves. Saved server records and other accounts' drafts are preserved. Drafts retained by choice remain unencrypted on the device. |
| Secrets/bootstrap | All .env variants are ignored except the blank example. No .env files were tracked or found in Git history in this checkout. Production seeding requires an explicit strong administrator password and does not create demo staff/sample customers. Demo seeding requires an explicit local-only flag. A read-only deployment check detects known demo passwords and privileged database roles. |

A pre-change database backup was created at
`.local/backups/before-security-hardening.backup`. The backup directory and this
backup now have private filesystem permissions. The additive sixth migration
creates login counters and invoice sequences. A second verified backup,
`.local/backups/before-email-verification.backup`, preceded the seventh migration
for email challenges. Both migrations preserve existing business rows.

## Confirmed access policy

The owner clarified that everyone using the CRM is individually granted access
by an administrator. The working policy is a private, shared CRM for these
approved accounts: they can view customers, projects, quotations and their files
in both companies and manage shared customer records. Assigned-project-only
visibility is not being introduced. The company switcher remains a view filter.

Only administrators can create accounts, activate/deactivate users, change roles,
reset passwords or edit company settings. Creating an approved user does not
automatically give that user administrator powers. Creator/administrator editing
and deletion rules remain in force for other records; work-group conversations
remain restricted to their selected members. There is no public signup.

## Decisions and launch requirements still open

1. **Real accounts:** the owner chose named replacement accounts followed by demo
   deactivation. Sukesh has chosen a private password and the named administrator
   account is now active. Confirm a sign-in with that account; real email-code
   verification still awaits provider setup. No password or email-service secret
   should be sent through chat. No demo account
   has been deactivated. The changeover endpoint/UI requires a real administrator's
   verified sign-in and preserves existing project/customer history. Direct demo
   deletion/deactivation has the same verification guard.
2. **Verification email:** the owner selected email codes. The implementation is
   complete for testing, but real delivery still needs a verified sender domain,
   RESEND_API_KEY and AUTH_EMAIL_FROM. Local development retains password login
   unless ADMIN_EMAIL_VERIFICATION=true; production always enforces email codes
   for administrators and fails closed without working delivery. Configure this
   only after the named administrator has a password and is active. Protect the
   receiving mailbox too: email verification depends on its security and is not
   phishing-resistant authentication. Self-service password recovery and
   force-change-on-first-login are not implemented.
3. **Hosting:** the owner requested a cost proposal before choosing/purchasing.
   See HOSTING_OPTIONS.md for the $45/month managed baseline and lower-cost
   self-managed alternative. On 19 October the owner deferred domain/hosting
   selection and requested completion of local preparation. No services have
   been purchased. On 20 October the owner selected Vercel and Gemini and requested
   guided provider setup; DEPLOYMENT_GUIDE.md records the order and current gaps.
   A temporary vercel.app address can be used once ready. Set a new random NEXTAUTH_SECRET,
   configure trusted proxy/edge rate limits and upload-body/time limits, private
   durable file storage and database TLS/network restrictions. Do not expose the
   PostgreSQL port publicly or serve .local/backups/.env files. Deploy a production
   build, never the development server.
4. **Backups/operations:** encrypted complete local backups and an isolated restore
   rehearsal are implemented and verified. The 19 October rehearsal restored all
   18 tables and three attachments, checking row counts and original file bytes.
   See SETUP.md for `backup:create` / `backup:verify` and separate key custody.
   Automated hosted backups, off-device storage, retention, a hosted restore
   rehearsal, access-controlled logs and alerting still need to be configured
   with the hosting provider. Older database-only backups remain unencrypted.
   A complete audit activity log for customer changes/exports is not implemented.
5. **Devices:** test the real HTTPS app on your dad's phone and the staff's iPhone/
   Android devices: login, installation, camera permissions, voice recording and
   replay, failed connections and sign-out. Current phone checks are browser tests.
6. **Browser drafts:** unfinished media stays in device IndexedDB; work-group
   message drafts use localStorage, scoped by account. They are not encrypted.
   Settings offers confirmed cleanup; sign-out offers clear, keep or cancel when
   drafts are present. Users sharing devices should choose clear and confirm it
   succeeds. Closing the browser or session expiry does not automatically erase
   retained drafts. Continue using locked device accounts.
7. **Optional AI:** no Gemini key is configured locally and review/tests send no
   real documents to an external AI service. If enabled later, document auto-fill
   sends the selected file to Google. Agree on disclosure, retention, provider
   access and a request quota before enabling it with customer information.
8. **Feature scope:** bulk automatic Excel-to-line-item import, independent invoice
   accounting/payment ledgers and AI-generated quotations are not implemented.
   Current invoice conversion attaches an invoice number/date to a quote; it is
   not an immutable financial ledger. Do not rely on it as the sole accounting
   record or delete issued financial records without a retention policy.

## Verification

- Production dependency audit: zero advisories on 19 October 2026.
- Full dependency audit on 17 October: nine development/build-tool findings (seven high, two
  moderate), involving Tailwind 3 / ESLint globbing and selector parsing. These
  are not production runtime findings. Do not use `npm audit fix --force`: its
  proposed Tailwind major upgrade and ESLint-config downgrade need compatibility
  work. Repeat the audit before release; restrict builds to trusted project input.
- Production build, lint and type checks passed.
- **All 43 regression tests passed against the final production build (1.5 minutes).**
  Coverage includes independent companies/customers, inline project customers,
  reports/PDFs, imports preserving original bytes, project pins/stars/deletion,
  compact visit pagination, photo/voice capture and playback, offline recovery,
  installation and work-group membership/chat/announcements. New security tests
  cover every business API anonymously, signup absence, CSRF,
  staff administration denial, cookie revocation, login throttling, request
  bounds, CSP, decimal totals, historical references and concurrent invoices.
  Email verification tests cover account binding, keyed code hashes, concurrent
  single use, replay rejection, expiry, five-guess limits, resend/send quotas,
  failed delivery, password-reset invalidation and guarded demo retirement.
  Browser checks also cover private password activation and retrying a failed
  network request without activating the account prematurely. Email delivery
  was intercepted by a local-only test transport; no real email was sent.
  Additional tests verify that encrypted backups reject modified data, wrong
  keys and exposed key files; draft cleanup requires confirmation, stays scoped
  to the current account, clears another open capture tab, and supports both
  keep/clear choices at sign-out. The separate restore rehearsal also passed.
- The first full run exposed a compatibility error in the new login-body guard;
  it was corrected before the passing run. Targeted testing also caught and fixed
  invalid pagination paths. These results validate the final code, not just the
  original application or a successful TypeScript build.
- A separate anonymous check confirmed redirects to login for dashboard, customers,
  projects, site visits, quotations, reports, settings, administrator users and
  work groups. Post-test checks found no leftover security-test users/companies;
  the original one project, three site visits, one customer and five active demo
  users remain. Sukesh is the sixth account, inactive and awaiting a private
  password; seven migrations are applied. The normal development server was
  restored after tests; it does not use the fake email transport.
- `npm run security:check` is read-only. It currently exits nonzero for the local
  HTTP domain, unconfigured verification email, missing durable UPLOAD_DIR and
  active demo accounts with five known passwords. Passing this script does not
  replace the manual requirements above.
- The 20 October deployment preparation adds a read-only Supabase check: when
  anon/authenticated database roles exist, CRM tables must have RLS and must not
  grant those roles direct privileges. The CRM uses NextAuth/server permissions;
  a separate Supabase Data API path must not bypass them. The privilege query was
  checked with allowed/unrelated local roles; hosted settings remain unverified.

## Reference guidance

- [NextAuth authentication CSRF protection](https://next-auth.js.org/getting-started/rest-api)
- [NextAuth session and secure-cookie options](https://next-auth.js.org/configuration/options)
- [OWASP password authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP bcrypt limits](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP cross-site request prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Next.js nonce CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy)
- [OWASP email verification limitations](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html#email)
- [Build-tool braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Build-tool selector-parser advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)
