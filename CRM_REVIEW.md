**SJSS CRM review — 15 October 2026**

This is the pre-implementation review. The first coding milestone now adds
Projects, captioned private media, voice capture, persistent drafts and PWA
installation support, and fixes session revocation, duplicate retries and PDF
export. See [SETUP.md](SETUP.md) for current behavior, tests and remaining work.

Updates since this review also include independent customer/company records,
customer creation within New Project, verified company-scoped reports, and a
navy/blue interface with light mode by default and an optional saved dark theme.
Project organisation now includes personal pins/stars and recoverable deletion;
site updates have a compact paginated list. Work groups support member-only chat
and administrator announcements, and the supplied gold logo is used for app
branding and installation icons. See SETUP.md for the verified current scope.
The 17 October pre-deployment audit and remaining launch blockers are recorded
in [SECURITY_REVIEW.md](SECURITY_REVIEW.md); all 43 local regression tests passed,
including administrator email-code verification and named-account activation.
Live email delivery and hosting setup remain pending. Current hosting costs are
in [HOSTING_OPTIONS.md](HOSTING_OPTIONS.md).
The 19 October local preparation adds encrypted database/file backups with a
passing isolated restore rehearsal and confirmed device-draft privacy controls.
The findings below describe the original checkout, not the current implementation.

The current application has a useful customer and quotation workflow, with basic
site photo/video capture. The strongest next step is a persistent Projects module,
supported by reliable mobile capture. Add features inside that structure so staff
do not have to navigate an expanding list of unrelated tools.

This was a review of the existing implementation. No application behavior was
changed as part of the review.

**What already exists**

| Area           | Current implementation                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| Customers      | Contact details, notes, search, archive, quotation history                                   |
| Quotations     | Line items, totals, status changes, import, PDF route, company numbering                     |
| Sales board    | Draft, sent, accepted and rejected quotations in a board view                                |
| Site visits    | Title, company/customer, location, notes, photo/video attachments, conversion to a quotation |
| Administration | Create users, change roles, reset passwords, deactivate/delete accounts                      |
| Communication  | Admin broadcasts/private notifications, inbox and replies, notification bell                 |
| Reporting      | Quotation analytics and report export route                                                  |
| Layout         | Desktop sidebar, mobile navigation drawer, company filter, light/dark theme                  |

Existence does not mean every path works: PDF export and account deactivation have
confirmed failures below. AI extraction and real phone video capture were not
validated end to end.

**Confirmed findings from localhost**

| Priority                        | Finding                                       | Evidence and impact                                                                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before staff use                | Deactivated accounts can sign in              | Created a temporary user, deactivated it through the admin API, then successfully authenticated it. `lib/auth.ts:25` checks for a user but never checks `isActive`. Role is also copied into the JWT at sign-in without a later database refresh; session revocation needs design work.                          |
| Before uploading business media | Uploaded photos are public by URL             | An unauthenticated request fetched the uploaded test PNG with HTTP 200. API endpoints themselves correctly returned 401 anonymously. `app/api/uploads/route.ts:63` saves into `public/uploads`, which bypasses authenticated download access.                                                                    |
| High                            | Default company blocks visit creation         | Under the global "All companies" filter, the form displays the first company, but Save Visit says to choose a company. `components/site-visits/SiteVisitCapture.tsx:31` keeps the empty `defaultCompanyId` because `??` does not fall back for an empty string. Explicitly selecting a company allowed the save. |
| High                            | Failed-upload retries create duplicate visits | Simulated an interrupted upload. The visit was already saved; pressing Save Visit again created a second visit. `components/site-visits/SiteVisitCapture.tsx:70` creates the visit on each submission before uploading. Resume against the same saved record, with duplicate-safe requests.                      |
| High                            | Quotation PDF export fails locally            | Export of a quotation created through visit conversion returned HTTP 500. The server logged "Unknown font format". Inspect external font registration in `lib/pdf-document.tsx:12` and bundle verified font files or use a supported built-in font.                                                              |
| High for field use              | Unfinished captures are lost on refresh       | Filled a title and selected a photo, then reloaded. Both disappeared. Drafts exist only in component memory; there is no persistent draft or upload queue.                                                                                                                                                       |
| Mobile usability                | Media controls depend on hover                | In a touch-emulated phone viewport, delete/download overlay controls had opacity 0 and measured 24 × 24 pixels. Use visible, labelled controls with comfortable touch targets. See `components/site-visits/SiteVisitDetail.tsx:230`.                                                                             |

**Structural gaps found in the code**

- There is no Project model. `prisma/schema.prisma:140` defines a SiteVisit with
  only CAPTURED/QUOTED status and one quotation link. A project needs to remain
  usable through multiple visits, quotations, work stages and completion.
- Conversion moves attachments from the visit to the quotation
  (`app/api/site-visits/[id]/convert/route.ts:63`). Confirmed that the visit's
  attachment count changed from 1 to 0 and its Add media button disappeared.
  Retain original visit/project ownership and link relevant media to quotes.
- Attachment metadata has no individual caption, room/area, media author,
  capture timestamp or audio duration (`prisma/schema.prisma:125`).
- There is no voice recorder/player workflow. An `audio/webm` upload was rejected
  with HTTP 400, "File type not allowed".
- There is no configured app manifest, app icon set, service worker or persistent
  offline capture queue. The running browser reported zero manifest links and
  zero registered service workers.
- Visit/quotation APIs generally permit any signed-in user to update/delete
  records. Agree on shared access versus assigned-project access, then enforce
  it on the server. The company switcher currently provides filtering, not
  membership-based authorization.
- Invoice conversion currently adds a number/date to a quotation. There are no
  invoice line-item snapshots, payments, deposits, balances or payment history.
  Number generation uses a count and can collide during concurrent requests or
  after deletions (`app/api/quotations/[id]/invoice/route.ts:21`).
- Reports derive "revenue" from accepted quote values, not received payments
  (`app/(dashboard)/reports/page.tsx:64`). Keep contracted value, billed value and
  money collected distinct when adding finance features.
- The site-visit page fetches at most 60 records without pagination
  (`app/(dashboard)/site-visits/page.tsx:29`). Customer history is also capped.
  Add pagination and usable filtering as data grows.
- Customer pages lack a combined history of visits, project updates, follow-ups,
  calls and messages. There are no task, reminder, schedule or audit-log models.
- Some network-error paths leave forms busy or remove items optimistically
  without checking success. Add consistent error recovery around saving,
  deleting, changing statuses and messaging.

**Dependencies and hosting readiness**

`npm audit` reported 19 affected packages: 2 critical, 14 high and 3 moderate.
The critical package entries were `next` and `next-auth`. These are dependency
advisory results, not proof that every listed exploit applies to this deployment.
Plan a tested upgrade of the supported framework/authentication stack before
public hosting; do not apply a blind force upgrade.

The upload handler buffers files in server memory and writes to the local public
directory. Its actual ceiling is 250 MB, but the rejection message still says
15 MB. Public hosting needs persistent private object storage, server-validated
ownership, file validation, appropriate limits and upload recovery. Account for
the existing NextAuth session when issuing Supabase upload/download tokens;
NextAuth sessions do not automatically become Supabase Auth sessions.

**Recommended product structure**

| Record            | Responsibility                                                                         |
| ----------------- | -------------------------------------------------------------------------------------- |
| Customer          | Who the work is for, contacts, relationship history                                    |
| Project           | Named job, site address, company, customer, assigned team, stage and dates             |
| Site visit/update | A dated entry within the project with author, notes and media                          |
| Media item        | Photo/video/audio with caption, capture/upload timestamps and optional area/stage tags |
| Quotation         | Commercial proposal linked to the project; allow multiple proposals/revisions          |
| Task              | Assigned action, due date, completion and related project or sales follow-up           |

A project should be creatable during an inquiry or first survey, before a quote
is accepted. Keep sales stages separate from delivery stages such as Planned,
In progress, On hold and Completed. Preserve each media item in its original
context; quotations can reference selected items without moving the originals.

Suggested field workflow:

1. Open My Projects and select a named job, or create a minimal new project.
2. Tap Capture and take multiple photos or choose existing media.
3. Add a caption to each photo; optionally tag a room and Before/During/After.
4. Record a voice note against the project update or a specific photo.
5. Show explicit status: Saved on device, Uploading, Synced or Needs retry.
6. Office staff see the same dated update in the project's history.

Useful project views: Overview, Updates, Media, Tasks and Quotations. Media is a
filtered view of the same project evidence; staff should not have to upload a
file twice to make it appear in different views.

**Home-screen app recommendation**

Confirmed platform target: both iPhone and Android. Site connectivity is currently
unknown, so include persistent capture drafts, clear synchronization state and
retryable uploads in the first mobile release. Validate the core workflow on
physical iPhone/Safari and Android/Chrome devices before staff rollout.

Build a Progressive Web App (PWA) on the existing website. Configure its manifest,
icons, launch URL and standalone display, plus platform-appropriate installation
guidance. Installation and offline support are separate pieces of work.

For real site use, publish an HTTPS address reachable from staff phones. A phone's
localhost address refers to the phone, not this Mac. Microphone recording needs
user permission and a secure context. Detect supported recording formats at
runtime rather than assuming one audio format works on all devices.

Persist drafts and media in a local queue, with retry and duplicate prevention.
Use offline support for the app shell and deliberate project data, with user
boundaries and a clear policy for device-held business data. Resume when the app
reconnects or is reopened; do not promise uploads or recording will continue
indefinitely after a phone locks or closes the app. Browser storage is not a
substitute for a server backup.

For voice notes, start with record, stop, listen, save and playback. Save useful
metadata such as author, time and duration. Handle denied microphone permission
and interruptions. Add transcription/search later, while retaining original audio.

**Keep navigation simple**

- Phone: Home, Projects, Capture, Tasks, More. Put assigned projects, today's tasks
  and pending uploads above charts. Keep inbox access visible through its badge.
- Office: group Customers and Quotations under Sales; Projects and Tasks under
  Work; Reports, Users and company settings under Management.
- Offer quotation List/Board views inside Quotations rather than presenting
  Kanban as an additional top-level product area.
- Show actions appropriate to a person's role and enforce those permissions in
  API routes. Field staff should have a short path to their jobs and capture.
- Use consistent light/dark styling: the quotation-import form currently mixes
  a light form surface into the dark interface. Associate labels with controls
  and give icon-only actions accessible names.

**Suggested release order**

1. Stabilize authentication/deactivation, private media access, visit defaults,
   upload retry, PDF export and dependencies. Add focused regression checks.
2. Build Projects, repeated site updates, per-photo captions and durable media
   ownership. Include basic assignments and project search.
3. Deliver the mobile PWA and fast capture workflow with saved drafts and clear
   synchronization status. Move uploads into private durable storage before
   exposing real business data publicly.
4. Add voice recording/playback and task/follow-up reminders. Prioritize queue
   recovery earlier if site connectivity is unreliable.
5. Add scheduling, snag/defect checklists, variation approvals and proper
   invoice/deposit/progress-payment tracking based on actual staff needs.

Optional later additions include before/after comparisons, a project photo-report
PDF, a controlled customer progress portal, audio transcription and job-cost
summaries. Avoid adding inventory, payroll or complex marketing automation until
there is a clear operational need.

**Verification and limits**

Inspected schema, authentication, roles, uploads, visits/conversion, customer and
quotation workflows, invoice numbering, navigation, messaging and reporting code.
Opened 13 authenticated routes in Chrome at desktop size. Checked six core views
at 390px width and the dashboard at 320px; those checked views had no document
horizontal overflow. Verified the mobile drawer, photo save, visit conversion,
interrupted-upload retry, draft reload, direct file access, audio rejection and
deactivated-account sign-in using temporary local data.

Removed the temporary visits, attachments, quotation and account afterwards;
confirmed zero visits/quotations and the original five seeded users remained.
The conversion test consumed one quotation sequence number. No messages were
sent. Cleared the temporary browser authentication-state file.

This was desktop Chrome with phone/touch emulation, not physical iPhone/Android
testing. Real camera selection, HEIC/video playback, microphone recording,
home-screen installation, mobile background behavior, AI extraction and hosted
Supabase policies still need dedicated validation. A production build/deployment
was not exercised during this review.

**Primary references**

- [PWA installation and manifest requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [iOS home-screen web apps](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/#every-site-can-be-a-web-app-on-ios-and-ipados)
- [Microphone permission and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MediaRecorder format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
- [Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [Private Supabase buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Next.js security update, 14 October 2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
