"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle,
  X,
  File,
  ImageIcon,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const VALID_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
const ALLOWED_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png"];
type Status = (typeof VALID_STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  return <File className="w-5 h-5 text-red-500" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Company {
  id: string;
  name: string;
  prefix: string;
}

export function QuotationImport({ companies, defaultCompanyId }: { companies: Company[]; defaultCompanyId?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractionVersion = useRef(0);
  const extractionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => {
    extractionVersion.current++;
    extractionRequest.current?.abort();
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [companyId, setCompanyId] = useState(defaultCompanyId || companies[0]?.id || "");
  useEffect(() => {
    if (defaultCompanyId) setCompanyId(defaultCompanyId);
  }, [defaultCompanyId]);
  const [quotationNumber, setQuotationNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [subject, setSubject] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<Status>("DRAFT");
  const [notes, setNotes] = useState("");

  function clearFields() {
    setQuotationNumber("");
    setCompanyName("");
    setSubject("");
    setAmount("");
    setDate("");
    setStatus("DRAFT");
    setNotes("");
    setAutoFilled(false);
  }

  const autoExtract = useCallback(async (f: File, version: number) => {
    const isPDF = f.type === "application/pdf";
    const isImage = f.type.startsWith("image/");
    if (!isPDF && !isImage) return;
    const controller = new AbortController();
    extractionRequest.current = controller;
    setExtracting(true);
    setAutoFilled(false);
    setExtractError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/quotations/extract", { method: "POST", body: fd, signal: controller.signal });
      const data = await res.json();
      if (version !== extractionVersion.current) return;

      if (!res.ok) {
        setExtractError(data.error ?? "Auto-fill failed — please fill in the fields manually.");
        return;
      }

      if (typeof data.quotationNumber === "string") setQuotationNumber(data.quotationNumber);
      if (typeof data.companyName === "string") setCompanyName(data.companyName);
      if (typeof data.subject === "string") setSubject(data.subject);
      if (typeof data.amount === "number" && Number.isFinite(data.amount) && data.amount >= 0) setAmount(String(data.amount));
      if (typeof data.date === "string") setDate(data.date);
      setAutoFilled(true);
    } catch {
      if (version === extractionVersion.current) setExtractError("Could not reach the server — please fill in the fields manually.");
    } finally {
      if (version === extractionVersion.current) {
        setExtracting(false);
        extractionRequest.current = null;
      }
    }
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      if (submitting) return;
      if (!ALLOWED_TYPES.includes(f.type) || !f.size || f.size > 10 * 1024 * 1024) {
        setError("Choose a non-empty PDF, Excel, Word or JPG/PNG file up to 10 MB.");
        return;
      }
      extractionVersion.current++;
      extractionRequest.current?.abort();
      setExtracting(false);
      setExtractError("");
      setFile(f);
      setError("");
      clearFields();
      autoExtract(f, extractionVersion.current);
    },
    [autoExtract, submitting]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  function removeFile() {
    extractionVersion.current++;
    extractionRequest.current?.abort();
    extractionRequest.current = null;
    setExtracting(false);
    setFile(null);
    clearFields();
    setError("");
    setExtractError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!companyId) { setError("Please select which company this quotation is for."); return; }
    if (!companyName.trim()) { setError("Company / Customer Name is required."); return; }
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) > 9999999999.99) { setError("Please enter a valid amount with at most two decimal places."); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      fd.append("companyId", companyId);
      fd.append("quotationNumber", quotationNumber.trim());
      fd.append("companyName", companyName.trim());
      fd.append("subject", subject.trim());
      fd.append("amount", amount);
      fd.append("date", date);
      fd.append("status", status);
      fd.append("notes", notes.trim());

      const res = await fetch("/api/quotations/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/quotations/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      {/* ── File drop zone ───────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-dx-ink mb-2">
          Quotation Document{" "}
          <span className="text-dx-ink-faint font-normal">(Excel, Word, PDF or JPG/PNG · up to 10 MB)</span>
        </label>

        {file ? (
          <div className="flex items-center gap-3 p-4 bg-dx-surface border border-dx-line rounded-xl">
            <FileIcon mime={file.type} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dx-ink truncate">{file.name}</p>
              <p className="text-xs text-dx-ink-faint">{formatBytes(file.size)}</p>
            </div>

            {/* Extraction status badge */}
            {extracting && (
              <span className="flex items-center gap-1.5 text-xs text-dx-accent font-medium bg-dx-accent/10 px-2.5 py-1 rounded-full">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Reading document…
              </span>
            )}
            {!extracting && autoFilled && (
              <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium bg-green-50 px-2.5 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5" />
                Auto-filled
              </span>
            )}
            {!extracting && extractError && (
              <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-full" title={extractError}>
                <AlertCircle className="w-3.5 h-3.5" />
                Auto-fill failed
              </span>
            )}

            <button
              type="button"
              disabled={submitting}
              aria-label="Remove selected document"
              onClick={removeFile}
              className="p-1 rounded-lg hover:bg-dx-surface-hover text-dx-ink-faint hover:text-dx-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-dx-accent bg-dx-accent/10"
                : "border-dx-line bg-dx-surface-2 hover:border-dx-accent hover:bg-dx-surface-hover"
            )}
          >
            <Upload className={cn("w-8 h-8 mx-auto mb-2", dragOver ? "text-dx-accent" : "text-dx-ink-faint")} />
            <p className="text-sm font-medium text-dx-ink-muted">Drop the quotation file here</p>
            <p className="text-xs text-dx-ink-faint mt-1">Keep the original file. Enter Excel/Word details manually; PDF/image suggestions need review.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}
      </div>

      {/* ── Metadata fields ──────────────────────────────────────── */}
      <fieldset disabled={extracting || submitting} className={cn("bg-dx-surface border border-dx-line rounded-xl p-5 space-y-4 transition-opacity", extracting && "opacity-60")}>
        <p className="text-sm font-semibold text-dx-ink flex items-center gap-2">
          <FileText className="w-4 h-4 text-dx-accent" />
          Quotation Details
          {autoFilled && !extracting && (
            <span className="text-xs font-normal text-dx-ink-faint ml-1">— review and edit if needed</span>
          )}
        </p>

        {/* Which company is this quotation for */}
        <div>
          <label className="block text-xs font-medium text-dx-ink-muted mb-1">
            Company <span className="text-red-400">*</span>
          </label>
          <select
            aria-label="Company"
            disabled={Boolean(defaultCompanyId)}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="input w-full"
            required
          >
            <option value="">Select a company…</option>
            {companies.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-dx-ink-faint mt-1">Which of your companies issued this quotation</p>
        </div>

        {/* Row 1: QT Number + Company */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="import-reference" className="block text-xs font-medium text-dx-ink-muted mb-1">
              Quotation Number <span className="text-dx-ink-faint font-normal">(optional)</span>
            </label>
            <input
              id="import-reference"
              type="text"
              value={quotationNumber}
              onChange={(e) => setQuotationNumber(e.target.value)}
              placeholder="e.g. SJSS/1798/2026"
              className="input w-full"
            />
            <p className="text-xs text-dx-ink-faint mt-1">Leave blank to auto-generate</p>
          </div>
          <div>
            <label htmlFor="import-customer" className="block text-xs font-medium text-dx-ink-muted mb-1">
              Company / Customer Name <span className="text-red-400">*</span>
            </label>
            <input
              id="import-customer"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Ms. Thaneswary"
              className="input w-full"
              required
            />
            <p className="text-xs text-dx-ink-faint mt-1">New customers are created automatically</p>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="import-subject" className="block text-xs font-medium text-dx-ink-muted mb-1">Subject</label>
          <input
            id="import-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Quotation for Variation Order"
            className="input w-full"
          />
        </div>

        {/* Amount + Date + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="import-amount" className="block text-xs font-medium text-dx-ink-muted mb-1">
              Amount (RM) <span className="text-red-400">*</span>
            </label>
            <input
              id="import-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2980"
              min="0"
              step="0.01"
              className="input w-full"
              required
            />
          </div>
          <div>
            <label htmlFor="import-date" className="block text-xs font-medium text-dx-ink-muted mb-1">Date</label>
            <input
              id="import-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label htmlFor="import-status" className="block text-xs font-medium text-dx-ink-muted mb-1">Status</label>
            <select
              id="import-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="input w-full"
            >
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="import-notes" className="block text-xs font-medium text-dx-ink-muted mb-1">Notes (optional)</label>
          <textarea
            id="import-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes…"
            rows={2}
            className="input w-full resize-none"
          />
        </div>
        <p className="text-xs text-dx-ink-muted">Imports start as Draft. Confirm the document’s actual status before changing it.</p>
      </fieldset>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/quotations"
          className="px-4 py-2 border border-dx-line rounded-lg text-sm font-medium text-dx-ink hover:bg-dx-surface-2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || extracting}
          className="dx-btn-gradient disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save Quotation
            </>
          )}
        </button>
      </div>
    </form>
  );
}
