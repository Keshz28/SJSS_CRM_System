# Existing Excel document import

Status: agreed requirements and proposed implementation, not an implemented importer.
The next input needed is representative quotation and invoice workbooks.

## Existing importer review

The existing single-document quotation importer has been hardened separately:
shared validation for dates, two-decimal amounts and statuses; original-file
validation before saving financial records; transactional customer/quotation/item/
attachment creation; file cleanup after a failed transaction; and cancellation
of stale PDF/image autofill when a document is removed or replaced. Imports now
default to Draft rather than assuming the document was sent. Extracted suggestions
are validated and remain editable before saving.

Regression tests use a synthetic Excel workbook to check original-byte retention,
concurrent duplicate handling, no leftover customer/quotation after bad input,
and cancellation of an in-flight autofill request.

This existing importer still creates a single summary line, accepts one file at
a time in the UI (10 MB maximum), and is not the staged bulk Excel reader proposed
below. Independent invoices, per-item workbook extraction, batch resume, revisions,
file-hash duplicate detection and company-specific legacy references remain to
be implemented. The synthetic test is not a substitute for testing real layouts.

## Confirmed requirements

- Primary user: the owner's father, who currently creates quotations and invoices in Excel.
- Each document is in a separate Excel file.
- Initial migration: hundreds of recent files, with room for continued growth.
- Preserve every original Excel file, including its layout and formulas, unchanged.
- Also create editable, searchable CRM records linked to company, customer and project.
- Keep SJ Sunrise Services and Sinar Jasa Trading independent.
- Historical import and AI drafting are separate features. AI drafting is now
  discussed in `AI_QUOTATION_PLAN.md` alongside hardening the existing importer.

## Original file and editable record

The original workbook is a downloadable source document. Editing CRM fields must
not overwrite it. CRM edits create recorded revisions; reproducing the father's
Excel layout for new exports is a separate template task that needs sample files.
Retaining an Excel file does not provide an Excel editor inside the browser.

Each document should retain its original filename, file hash, uploader, import
batch, original reference and document date. Import time is recorded separately.
Original numbers must not be silently replaced by newly generated CRM numbers.

## Import experience

1. Select multiple workbooks. Choose the issuing company for the batch; allow
   per-document correction before committing records.
2. Upload with bounded concurrency, per-file progress and retry support. Preserve
   progress so a failed file does not require repeating completed uploads.
3. Read worksheets into candidate document records and line items. Inspect every
   worksheet; flag unexpected layouts or multiple documents rather than assuming
   the first sheet is the complete document. Do not execute workbook macros.
4. Review candidates against their source contents. Show type, company, number,
   date, customer, project, quantities, units, rates, adjustments and totals where
   present. Mark missing values and differences in calculated totals for review.
5. Match an existing customer/project within the selected company, or create one
   inline. Suggested matches need confirmation when ambiguous. Unknown project
   links can remain pending; do not invent a project from a filename.
6. Commit reviewed documents individually. A failed document must not leave a
   partial financial record. Retry keys prevent repeated commits after timeouts.
7. Display an import summary: imported, needs review, possible duplicate, failed.
   Keep pending records out of normal financial reporting.

For a large initial upload, provide a batch review queue with pagination. Users
should not need to complete hundreds of forms in one sitting. Document lists and
search results must also be paginated; the initial migration count is not a
hard-coded lifetime file limit.

## Matching, invoices and revisions

- Check repeated file contents and existing references within the issuing company.
  Offer an explicit decision for possible duplicates or revisions, rather than
  overwriting a record or treating every repeated reference as a new sale.
- Allow the two companies to retain their own original document references.
  The current globally unique quotation number needs a migration design for this.
- Invoices need their own records and line-item snapshots. A project can contain
  quotations, revisions and multiple invoices, including invoices without an
  available source quotation. Confirm deposit/progress/final invoice needs using
  the sample documents.
- Do not infer quotation acceptance or invoice payment from the existence of a
  document. Preserve unknown status for review. Keep quotation value, invoiced
  amount and receipts separate so reports do not double count them.

## Storage and rollout

The current development database and files are local. Removing reliance on a
laptop requires deployed application hosting, a hosted database, durable private
file storage, and backups covering both records and original files. Capacity
planning depends on actual workbook sizes, rather than document count alone.

Start with a representative pilot batch. Verify original downloads, extracted
line items, document totals, company boundaries, links, duplicate handling and
report totals before processing the remaining files. Keep the source collection
intact until the migration and recovery process have been verified.

## Sample files needed next

Provide copies of a quotation and its related invoice, plus another layout or
revision if available. Preserve cell structure and formulas when anonymising.
Local samples may be placed in `.local/import-samples/`, which is excluded from
Git by the existing `.local/` ignore rule. Do not commit customer workbooks.

After inspecting samples, choose the workbook reader, define the field mapping,
and implement the invoice/document model and staged import interface. Accurate
line-item extraction and export layout compatibility remain unverified until
representative files have been tested.

## Later: AI drafting

Use reviewed historical records as a potential source for reusable descriptions
and price references. Design AI drafts, the father's edits and approval, and
saved revisions separately from customer acceptance. This workflow is the next
discussion after historical imports are settled.
