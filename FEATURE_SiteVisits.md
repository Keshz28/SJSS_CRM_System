# Feature: Site Visits (Field Capture)

**Goal:** Replace dad's WhatsApp habit. Let him capture site photos + typed notes *in the system* while on-site, then turn that capture into a Quotation with one button at his desk.

**Funnel it fits into:** `Site Visit → Quotation → Invoice` (mirrors the existing "Convert to Invoice" pattern).

## Decisions (agreed during brainstorm — 2026-06-25)
- **Who:** Supports a mix — link an existing customer *or* type loose contact details for a new prospect (customer auto-created on convert).
- **Connectivity:** Online-first (he usually has signal). Offline/PWA deferred to the future app version.
- **Notes:** Free-form (one big notes box), closest to his WhatsApp habit. Structured fields can come later.
- **Camera:** Native camera via `<input type="file" accept="image/*" capture="environment">` — simple, mobile-friendly, and carries straight into the future app wrapper.
- **Storage sequencing:** Built on the **existing local `public/uploads/` pattern** first so each phase ships working and testable. Migrating to Supabase Storage is its own isolated phase (Phase 5) to avoid bundling a risky change into the new feature. (Note: local uploads are known-broken on serverless/redeploy — must do Phase 5 before going live.)

## Data model (Phase 1 — DONE ✅)
New `SiteVisit` model + `SiteVisitStatus` enum (`CAPTURED` → `QUOTED`):
- `companyId` (required — multi-company), `customerId?` (link existing), `contactName?` / `contactPhone?` (new prospect), `location?`, `title`, `notes?`
- `status`, `quotationId?` (@unique, set on convert), `createdById`
- `attachments` — reuses the `Attachment` model
`Attachment` changed: `quotationId` now **nullable**, added nullable `siteVisitId` — one attachment belongs to a quotation **or** a site visit. Back-relations added to User/Company/Customer/Quotation.
Schema validated + `prisma db push` applied to Supabase. ✅

---

## Build phases & status

| Phase | What | Status |
|-------|------|--------|
| 1 | Schema: `SiteVisit` model, `Attachment.siteVisitId`, db push | ✅ Done |
| 2 | API routes: CRUD, photo upload, convert-to-quotation | ✅ Done |
| 3 | UI: capture screen, list, detail pages + Sidebar nav link | ✅ Done |
| 4 | Wire up "Create Quotation from visit" convert flow | ✅ Done (in detail page) |
| 5 | (Later) Migrate image storage to Supabase Storage | ⬜ Pending |

**Typecheck:** `npx tsc --noEmit` passes clean after Phases 1–4 + the media update.

## Media: photos + videos (updated 2026-06-25)
- Capture + detail inputs accept `image/*,video/*` with `capture="environment"`. On a phone this opens the native camera (photo or video); on desktop it's a file picker (no rear camera — expected, desk-side use only).
- Allowed video types: mp4, quicktime/.mov, webm, 3gpp, x-matroska. Allowed image types include jpg/png/gif/webp/heic/heif.
- **No count limit per visit** (deliberate — user plans to upgrade Supabase storage; keep it future-proof).
- **Per-file size ceiling: 250 MB** — a safety valve, not a product limit; raise freely.
- Previews: capture screen and detail gallery render `<video>` for clips (controls in detail); list thumbnail shows the first frame with a play badge.
- ⚠️ **Videos make Phase 5 important.** The current upload route buffers the whole file in memory before writing to local disk — fine in local dev, but it won't survive serverless and wastes memory on big clips. Large video really wants **direct/resumable uploads to Supabase Storage** (Phase 5).

## Save a copy to the device (added 2026-06-25)
The system is the durable/backed-up copy. For an *extra* copy on the phone/PC, the detail page has **manual save buttons** (user's choice over auto-download):
- Per-media hover button (desktop) + **"Save all"** in the Media header (works on mobile too).
- Uses an `<a download>` to Downloads — no blob buffering, so big videos don't load into JS memory.
- **Platform reality (OS sandbox — can't be coded around):** a web app *cannot* write directly to the phone Camera Roll / gallery. Save = goes to Downloads (Android images usually then appear in Gallery; iPhone needs a manual "Save to Photos" tap). True silent gallery-save is a **native-app** feature (Capacitor/React Native) for the future app.
- **Important:** media moves OFF the visit onto the quotation when converted, so **Save all must be used before converting** if a device copy is wanted. (Could add the same save buttons to the quotation attachment panel later if needed.)

### Phase 2 — planned API surface
- `POST /api/site-visits` — create a visit
- `GET  /api/site-visits` — list (company filter + search)
- `GET/PUT/DELETE /api/site-visits/[id]`
- `POST /api/uploads` — extend to accept `siteVisitId` (reuses existing upload + `/api/uploads/[id]` delete)
- `POST /api/site-visits/[id]/convert` — create quotation (auto-create customer if new), move photos to the quote, set status `QUOTED` + link

### Phase 3 — planned screens (styled in `dx-` dark tokens)
- `/site-visits` (list), `/site-visits/new` (capture), `/site-visits/[id]` (detail)
- Components: `SiteVisitCapture.tsx`, `SiteVisitList.tsx`, `SiteVisitDetail.tsx`
- Sidebar: new "Site Visits" nav link (Camera icon)

## Files touched
- `prisma/schema.prisma` — SiteVisit model, enum, Attachment + back-relations (Phase 1)
- `app/api/site-visits/route.ts` — list + create (Phase 2)
- `app/api/site-visits/[id]/route.ts` — get / update / delete (Phase 2)
- `app/api/site-visits/[id]/convert/route.ts` — convert to quotation (Phase 2)
- `app/api/uploads/route.ts` — now accepts `siteVisitId`; +webp/heic, 15 MB limit (Phase 2)
- `components/layout/Sidebar.tsx` — "Site Visits" nav link, Camera icon (Phase 3)
- `components/site-visits/SiteVisitCapture.tsx` — field capture screen (Phase 3)
- `components/site-visits/SiteVisitList.tsx` — visit grid + search/filter (Phase 3)
- `components/site-visits/SiteVisitDetail.tsx` — photos, notes, convert, delete (Phase 3/4)
- `app/(dashboard)/site-visits/page.tsx` — list page (Phase 3)
- `app/(dashboard)/site-visits/new/page.tsx` — capture page (Phase 3)
- `app/(dashboard)/site-visits/[id]/page.tsx` — detail page (Phase 3)

## How to test (manual)
1. Restart `npm run dev`, open **Site Visits** in the sidebar → **New Visit**.
2. Tap **Take / Add** (on a phone this opens the camera; on desktop it's a file picker). Add a few photos.
3. Pick a company, add a title, choose New prospect or Existing customer, type notes, **Save Visit**.
4. On the detail page, add more photos or delete some, then **Create Quotation** → lands on the quote editor with the title as subject, notes carried over, and photos moved onto the quote as attachments. The visit flips to **Quoted** and links to the quote.

## How to run after a schema change
The Next.js dev server locks the Prisma engine DLL on Windows. If `prisma generate` fails with `EPERM`, stop `npm run dev`, run the prisma command, then restart `npm run dev`.
