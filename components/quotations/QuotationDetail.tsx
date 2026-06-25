"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, dxStatusColor, statusLabel } from "@/lib/utils";
import {
  ArrowLeft, Pencil, Download, Paperclip, Trash2,
  CheckCircle, Send, XCircle, RotateCcw, Upload, FileIcon, X, Receipt,
} from "lucide-react";

interface Item {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  total: string | number;
  order: number;
}

interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  filesize: number;
  uploadedAt: string;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  subject: string | null;
  notes: string | null;
  terms: string | null;
  totalAmount: string | number;
  validUntil: string | null;
  invoiceNumber: string | null;
  invoicedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string; name: string; contactPerson: string | null;
    email: string | null; phone: string | null; address: string | null; city: string | null;
  };
  company: { id: string; name: string; prefix: string } | null;
  items: Item[];
  attachments: Attachment[];
  createdBy: { name: string };
}

const STATUS_ACTIONS = {
  DRAFT: [{ label: "Mark as Sent", status: "SENT", icon: Send, variant: "gradient" as const }],
  SENT: [
    { label: "Mark Accepted", status: "ACCEPTED", icon: CheckCircle, variant: "success" as const },
    { label: "Mark Rejected", status: "REJECTED", icon: XCircle, variant: "danger" as const },
  ],
  ACCEPTED: [{ label: "Revert to Sent", status: "SENT", icon: RotateCcw, variant: "ghost" as const }],
  REJECTED: [{ label: "Revert to Draft", status: "DRAFT", icon: RotateCcw, variant: "ghost" as const }],
};

const variantClass = {
  gradient: "dx-btn-gradient",
  success: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#14CA74]/15 text-[#14CA74] border border-[#14CA74]/30 hover:bg-[#14CA74]/25 transition-colors",
  danger: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#FF5A65]/15 text-[#FF5A65] border border-[#FF5A65]/30 hover:bg-[#FF5A65]/25 transition-colors",
  ghost: "dx-btn-ghost",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function QuotationDetail({ quotation: initial }: { quotation: Quotation }) {
  const router = useRouter();
  const [quotation, setQuotation] = useState(initial);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [convertingInvoice, setConvertingInvoice] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    const res = await fetch(`/api/quotations/${quotation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setUpdatingStatus(false);
    if (res.ok) {
      const updated = await res.json();
      setQuotation((prev) => ({ ...prev, status: updated.status }));
      router.refresh();
    }
  }

  async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("quotationId", quotation.id);
    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    setUploading(false);
    if (res.ok) {
      const attachment = await res.json();
      setQuotation((prev) => ({ ...prev, attachments: [attachment, ...prev.attachments] }));
    }
    e.target.value = "";
  }

  async function handleConvertToInvoice() {
    setConvertingInvoice(true);
    const res = await fetch(`/api/quotations/${quotation.id}/invoice`, { method: "POST" });
    setConvertingInvoice(false);
    if (res.ok) {
      const data = await res.json();
      setQuotation((prev) => ({ ...prev, invoiceNumber: data.invoiceNumber, invoicedAt: data.invoicedAt }));
    }
  }

  async function handleDeleteAttachment(id: string) {
    if (!confirm("Remove this attachment?")) return;
    await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    setQuotation((prev) => ({ ...prev, attachments: prev.attachments.filter((a) => a.id !== id) }));
  }

  const actions = STATUS_ACTIONS[quotation.status as keyof typeof STATUS_ACTIONS] ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/quotations" className="dx-btn-ghost p-2.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${dxStatusColor(quotation.status)}`}>
          {statusLabel(quotation.status)}
        </span>
        <div className="flex-1" />
        {actions.map((action) => (
          <button
            key={action.status}
            onClick={() => handleStatusChange(action.status)}
            disabled={updatingStatus}
            className={`${variantClass[action.variant]} disabled:opacity-50`}
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </button>
        ))}
        {/* Convert to Invoice */}
        {quotation.status === "ACCEPTED" && !quotation.invoiceNumber && (
          <button
            onClick={handleConvertToInvoice}
            disabled={convertingInvoice}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[#14CA74]/15 text-[#14CA74] border border-[#14CA74]/30 hover:bg-[#14CA74]/25 transition-colors disabled:opacity-50"
          >
            <Receipt className="w-4 h-4" />
            {convertingInvoice ? "Converting…" : "Convert to Invoice"}
          </button>
        )}
        {quotation.invoiceNumber && (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#14CA74]/10 text-[#14CA74] text-xs font-semibold border border-[#14CA74]/20">
            <Receipt className="w-3.5 h-3.5" />
            {quotation.invoiceNumber}
          </span>
        )}
        <a
          href={`/api/quotations/${quotation.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="dx-btn-ghost"
        >
          <Download className="w-4 h-4" />
          PDF
        </a>
        <Link href={`/quotations/${quotation.id}/edit`} className="dx-btn-ghost">
          <Pencil className="w-4 h-4" />
          Edit
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Info card */}
          <div className="dx-card p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Quote No.</p>
                <p className="font-mono font-semibold text-dx-accent">{quotation.quotationNumber}</p>
              </div>
              <div>
                <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Company</p>
                <p className="font-medium text-dx-ink">{quotation.company?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Date</p>
                <p className="font-medium text-dx-ink">{formatDate(quotation.createdAt)}</p>
              </div>
              {quotation.validUntil && (
                <div>
                  <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Valid Until</p>
                  <p className="font-medium text-dx-ink">{formatDate(quotation.validUntil)}</p>
                </div>
              )}
              {quotation.invoiceNumber && (
                <div>
                  <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Invoice No.</p>
                  <p className="font-mono font-semibold text-[#14CA74]">{quotation.invoiceNumber}</p>
                </div>
              )}
              {quotation.subject && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Subject</p>
                  <p className="font-medium text-dx-ink">{quotation.subject}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="dx-card overflow-hidden">
            <div className="px-5 py-4 border-b border-dx-line">
              <h3 className="text-sm font-semibold text-dx-ink">Line Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dx-line">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Description</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Qty</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Unit Price</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item) => (
                    <tr key={item.id} className="border-b border-dx-line last:border-0 hover:bg-dx-surface-hover">
                      <td className="px-5 py-3 text-dx-ink">{item.description}</td>
                      <td className="px-5 py-3 text-right text-dx-ink-muted">{Number(item.quantity)}</td>
                      <td className="px-5 py-3 text-right text-dx-ink-muted">{formatCurrency(Number(item.unitPrice))}</td>
                      <td className="px-5 py-3 text-right font-semibold text-dx-ink">{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-dx-line">
                    <td colSpan={3} className="px-5 py-3 text-right font-semibold text-dx-ink-muted">Total Amount</td>
                    <td className="px-5 py-3 text-right font-bold text-lg text-dx-accent">
                      {formatCurrency(Number(quotation.totalAmount))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes + Terms */}
          {(quotation.notes || quotation.terms) && (
            <div className="dx-card p-5 space-y-4">
              {quotation.notes && (
                <div>
                  <p className="text-xs font-semibold text-dx-ink-faint uppercase tracking-wide mb-2">Notes</p>
                  <p className="text-sm text-dx-ink whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              )}
              {quotation.terms && (
                <div>
                  <p className="text-xs font-semibold text-dx-ink-faint uppercase tracking-wide mb-2">Terms & Conditions</p>
                  <p className="text-sm text-dx-ink-muted whitespace-pre-wrap">{quotation.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="dx-card p-5">
            <h3 className="text-sm font-semibold text-dx-ink mb-3">Customer</h3>
            <div className="space-y-1 text-sm">
              <Link href={`/customers/${quotation.customer.id}`} className="font-medium text-dx-accent hover:opacity-80 block">
                {quotation.customer.name}
              </Link>
              {quotation.customer.contactPerson && <p className="text-dx-ink-muted">{quotation.customer.contactPerson}</p>}
              {quotation.customer.email && <p className="text-dx-ink-muted">{quotation.customer.email}</p>}
              {quotation.customer.phone && <p className="text-dx-ink-muted">{quotation.customer.phone}</p>}
              {quotation.customer.city && <p className="text-dx-ink-muted">{quotation.customer.city}</p>}
            </div>
          </div>

          {/* Attachments */}
          <div className="dx-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-dx-ink">Attachments</h3>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleAttachmentUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                <span className="flex items-center gap-1 text-xs text-dx-accent hover:opacity-80 font-medium">
                  {uploading ? "Uploading…" : <><Upload className="w-3 h-3" /> Upload</>}
                </span>
              </label>
            </div>
            {quotation.attachments.length === 0 ? (
              <p className="text-xs text-dx-ink-faint">No attachments.</p>
            ) : (
              <div className="space-y-2">
                {quotation.attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 text-xs">
                    <FileIcon className="w-3.5 h-3.5 text-dx-ink-faint flex-shrink-0" />
                    <a href={`/${att.filepath}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-dx-accent hover:opacity-80 truncate">
                      {att.filename}
                    </a>
                    <span className="text-dx-ink-faint flex-shrink-0">{formatFileSize(att.filesize)}</span>
                    <button onClick={() => handleDeleteAttachment(att.id)} className="text-dx-ink-faint hover:text-dx-danger transition-colors flex-shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="dx-card p-5 text-xs text-dx-ink-faint space-y-1">
            <p>Created by <span className="text-dx-ink font-medium">{quotation.createdBy.name}</span></p>
            <p>Created {formatDate(quotation.createdAt)}</p>
            <p>Last updated {formatDate(quotation.updatedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
