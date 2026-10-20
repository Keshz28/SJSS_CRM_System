# AI quotation workflow proposal

Status: proposed product workflow, not an implemented quotation generator.
The existing PDF/image metadata autofill is a different, limited feature.

20 October update: the owner selected Gemini for the first integration and Vercel
for hosting. The Claude section below is retained as an earlier design option;
its safety, pricing, validation and approval requirements still apply to Gemini.
Account/key/billing setup and a supported-model integration are still pending.
See DEPLOYMENT_GUIDE.md for the staged setup sequence. No paid AI calls have been
enabled as part of provider selection.

## Proposed Claude integration — 19 October discussion

Use the Claude Messages API from an authenticated server endpoint for the first
quotation assistant. Claude Code CLI can help develop the CRM; a constrained API
request is the proposed runtime integration for drafting quotations. No Claude
quotation generator or paid API calls are being enabled by this planning update.

Start without model fine-tuning. Configure explicit instructions for the father's
wording, item order, units, terms and company-specific rules. Include a few
approved quotation examples and retrieve relevant approved rates/history from
the CRM for each job. This provides context per request; it does not permanently
train Claude or make it automatically remember corrections. Save approved edits
and deliberately reuse reviewed examples to improve later drafts.

Suggested initial inputs are three to five representative approved quotations,
an approved price list, and one site's notes/photos. Voice notes first need an
editable transcription step. Confirm the transcription service's supported
formats/languages and costs separately. Photos help describe work but cannot
establish reliable dimensions or authoritative prices by themselves.

Request structured line items, missing-information questions and source/rate
references. Validate the response on the server, authorize every selected source,
and use decimal application calculations. A valid JSON schema does not establish
that the work scope, quantities or prices are correct. Unpriced/unmeasured items
must remain unresolved until the father supplies or confirms them. Do not convert
missing rates to zero or silently choose an old rate.

Keep the API key on the server, apply per-user request/token limits, and show which
site information will be sent to the provider. Retrieved documents, captions and
transcripts are reference material, never authorization to run commands, access
other projects or issue a quotation. The assistant's draft endpoint must not send
documents or approve a revision on the user's behalf. Approval and issue actions
remain explicit, separate authenticated operations with immutable saved versions.

API usage is billed separately from a Claude app subscription. Select the model
and set a budget after measuring representative requests; no monthly estimate is
reliable yet without the image count, transcript length and quotation volume.

References: [Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages),
[prompting examples](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices),
[structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
[image inputs](https://platform.claude.com/docs/en/build-with-claude/vision).

## Intended experience

1. Open the correct company and project. Select site photos, descriptions and
   voice notes, or simply type the work required. Preserve source attachments.
2. Transcribe voice notes into editable text. Draft a scope of work and show
   missing information, such as dimensions, materials, quantities or access needs.
   Ask for confirmation instead of silently filling gaps.
3. Draft quotation line items with description, quantity, unit and rate. Let the
   father supply or change prices directly, or request changes in plain language.
4. Show a full quotation preview and highlight revisions to scope, quantities,
   rates and totals. Keep the document marked Draft while changes are discussed.
5. The father explicitly approves the reviewed version. Save an approved snapshot
   and downloadable document under the company, customer and project. Keep any
   later edits in a new revision requiring fresh approval.

## Pricing and quantities

Start with a small price catalogue approved by the father, scoped by company.
Each rate needs its unit, conditions and a reviewed date. Historical quotations
can suggest descriptions or reference prices; an old price is not automatically
the correct rate for a new job. Mark matches and estimates for review.

The first version should use approved rates or ask for a missing rate. Introducing
AI-estimated prices can be a later option, clearly labelled and requiring review.
Do not treat an unpriced item as free, or invent quantities from photographs.
Photos support drafting a description; measurements and specifications still
need confirmed inputs. Preserve the father's edits when regenerating a draft.

Calculate line totals, adjustments and document totals in application code using
decimal arithmetic. The AI proposes structured fields; it does not set authoritative
totals or approve its own work. Validate those fields before creating a draft.

## Approval and saved versions

- Drafts may save progress automatically, clearly identified as unapproved.
- Approval belongs to the designated human approver, initially the father.
- Store who approved, when, and the exact approved content and prices.
- Father's approval to issue a quotation is separate from sending it to a customer
  and from the customer's acceptance. Do not mark a quote Accepted on approval.
- An approved quotation or later invoice must retain its own content snapshot.
  Editing a reusable price catalogue must not change previous documents.
- Link suggested items to source notes and price references so questions can be
  resolved without rereading every site attachment.

## Keep the interface focused

Place a **Draft quotation with AI** action inside the project. Use three steps:
**Site information → Review items and prices → Preview and approve**. Keep price
catalogue maintenance in Settings and show advanced options only when needed.

## First implementation scope

Use one real job, representative original workbooks and a short approved price
list to test the complete draft/edit/approve flow. Confirm missing measurements,
changed prices, company boundaries, decimal totals, saved revisions and document
output before expanding it. Preserving the father's export layout needs template
work based on sample files; keeping his original Excel files does not provide
that export template automatically.

AI provider, transcription service, running costs and document-processing settings
remain implementation decisions. Quotation generation is not implemented in this
stage. Historical import work remains tracked in
`DOCUMENT_IMPORT_PLAN.md`.
