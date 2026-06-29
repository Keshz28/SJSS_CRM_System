"use client";

import { useState, useCallback, useRef } from "react";
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

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? companies[0]?.id ?? "");
  const [quotationNumber, setQuotationNumber] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [subject, setSubject] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<Status>("SENT");
  const [notes, setNotes] = useState("");

  function clearFields() {
    setQuotationNumber("");
    setCompanyName("");
    setSubject("");
    setAmount("");
    setDate("");
    setStatus("SENT");
    setNotes("");
    setAutoFilled(false);
  }

  const autoExtract = useCallback(async (f: File) => {
    const isPDF = f.type === "application/pdf";
    const isImage = f.type.startsWith("image/");
    if (!isPDF && !isImage) return;

    setExtracting(true);
    setAutoFilled(false);
    setExtractError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/quotations/extract", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setExtractError(data.error ?? "Auto-fill failed — please fill in the fields manually.");
        return;
      }

      if (data.quotationNumber) setQuotationNumber(data.quotationNumber);
      if (data.companyName) setCompanyName(data.companyName);
      if (data.subject) setSubject(data.subject);
      if (data.amount != null) setAmount(String(data.amount));
      if (data.date) setDate(data.date);
      setAutoFilled(true);
    } catch {
      setExtractError("Could not reach the server — please fill in the fields manually.");
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      setError("");
      clearFields();
      autoExtract(f);
    },
    [autoExtract]
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
    if (!amount || isNaN(parseFloat(amount))) { setError("Please enter a valid amount."); return; }

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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Quotation Document{" "}
          <span className="text-gray-400 font-normal">(PDF or image — auto-fills fields below)</span>
        </label>

        {file ? (
          <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
            <FileIcon mime={file.type} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
            </div>

            {/* Extraction status badge */}
            {extracting && (
              <span className="flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
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
              onClick={removeFile}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
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
                ? "border-primary bg-primary/5"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
            )}
          >
            <Upload className={cn("w-8 h-8 mx-auto mb-2", dragOver ? "text-primary" : "text-gray-400")} />
            <p className="text-sm font-medium text-gray-600">Drop the quotation file here</p>
            <p className="text-xs text-gray-400 mt-1">PDF or image — fields will be auto-filled from the document</p>
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
      <div className={cn("bg-white border rounded-xl p-5 space-y-4 transition-opacity", extracting && "opacity-60 pointer-events-none")}>
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Quotation Details
          {autoFilled && !extracting && (
            <span className="text-xs font-normal text-gray-400 ml-1">— review and edit if needed</span>
          )}
        </p>

        {/* Which company is this quotation for */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Company <span className="text-red-400">*</span>
          </label>
          <select
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
          <p className="text-xs text-gray-400 mt-1">Which of your companies issued this quotation</p>
        </div>

        {/* Row 1: QT Number + Company */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Quotation Number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={quotationNumber}
              onChange={(e) => setQuotationNumber(e.target.value)}
              placeholder="e.g. SJSS/1798/2026"
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Company / Customer Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Ms. Thaneswary"
              className="input w-full"
              required
            />
            <p className="text-xs text-gray-400 mt-1">New customers are created automatically</p>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Quotation for Variation Order"
            className="input w-full"
          />
        </div>

        {/* Amount + Date + Status */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Amount (RM) <span className="text-red-400">*</span>
            </label>
            <input
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
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
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes…"
            rows={2}
            className="input w-full resize-none"
          />
        </div>
      </div>

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
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || extracting}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
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
