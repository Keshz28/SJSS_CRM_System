"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, Camera, FileText, Trash2, X, ImagePlus, MapPin, Phone, FileUp, Download,
} from "lucide-react";

/** Save a same-origin file to the device (Downloads). Avoids loading big videos into JS memory. */
function downloadFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  mimetype: string;
}

interface Visit {
  id: string;
  title: string;
  location: string | null;
  status: "CAPTURED" | "QUOTED";
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  company: { id: string; name: string; prefix: string } | null;
  attachments: Attachment[];
  quotation: { id: string; quotationNumber: string } | null;
  createdBy: { name: string };
}

export function SiteVisitDetail({ visit: initial }: { visit: Visit }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visit, setVisit] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");

  const isQuoted = visit.status === "QUOTED";

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("siteVisitId", visit.id);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (res.ok) {
        const att = await res.json();
        setVisit((prev) => ({ ...prev, attachments: [...prev.attachments, att] }));
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "A photo failed to upload.");
      }
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleDeletePhoto(id: string) {
    if (!confirm("Remove this photo?")) return;
    await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    setVisit((prev) => ({ ...prev, attachments: prev.attachments.filter((a) => a.id !== id) }));
  }

  async function handleConvert() {
    setConverting(true);
    setError("");
    const res = await fetch(`/api/site-visits/${visit.id}/convert`, { method: "POST" });
    if (res.ok) {
      const { quotationId } = await res.json();
      router.push(`/quotations/${quotationId}/edit`);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not create the quotation.");
      setConverting(false);
    }
  }

  async function handleSaveAll() {
    for (const att of visit.attachments) {
      downloadFile(`/${att.filepath}`, att.filename);
      // Small stagger so the browser doesn't drop rapid-fire downloads.
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  async function handleDeleteVisit() {
    if (!confirm("Delete this site visit and its photos? This cannot be undone.")) return;
    await fetch(`/api/site-visits/${visit.id}`, { method: "DELETE" });
    router.push("/site-visits");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/site-visits" className="dx-btn-ghost p-2.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          isQuoted ? "bg-[#14CA74]/15 text-[#14CA74]" : "bg-[#00C2FF]/15 text-[#00C2FF]"
        }`}>
          {isQuoted ? "Quoted" : "Captured"}
        </span>
        <div className="flex-1" />
        {isQuoted && visit.quotation ? (
          <Link href={`/quotations/${visit.quotation.id}`} className="dx-btn-ghost">
            <FileText className="w-4 h-4" />
            {visit.quotation.quotationNumber}
          </Link>
        ) : (
          <button onClick={handleConvert} disabled={converting} className="dx-btn-gradient disabled:opacity-50">
            <FileText className="w-4 h-4" />
            {converting ? "Creating…" : "Create Quotation"}
          </button>
        )}
        <button
          onClick={handleDeleteVisit}
          className="dx-btn-ghost text-dx-ink-faint hover:text-[#FF5A65]"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-[#FF5A65]/15 border border-[#FF5A65]/30 text-[#FF5A65] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {isQuoted && (
        <div className="rounded-xl bg-[#14CA74]/10 border border-[#14CA74]/20 text-[#14CA74] px-4 py-3 text-sm">
          The photos from this visit were moved onto quotation{" "}
          {visit.quotation && (
            <Link href={`/quotations/${visit.quotation.id}`} className="font-semibold underline">
              {visit.quotation.quotationNumber}
            </Link>
          )}.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Photos */}
        <div className="lg:col-span-2 space-y-5">
          <div className="dx-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-dx-ink">Media ({visit.attachments.length})</h3>
              <div className="flex items-center gap-4">
                {visit.attachments.length > 0 && (
                  <button
                    onClick={handleSaveAll}
                    className="flex items-center gap-1.5 text-xs text-dx-ink-muted hover:text-dx-ink font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Save all
                  </button>
                )}
                {!isQuoted && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={handleAddPhotos}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 text-xs text-dx-accent hover:opacity-80 font-medium disabled:opacity-50"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {uploading ? "Uploading…" : "Add media"}
                    </button>
                  </>
                )}
              </div>
            </div>
            {visit.attachments.length === 0 ? (
              <div className="py-10 text-center text-dx-ink-faint">
                <Camera className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">No photos or videos on this visit.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visit.attachments.map((att) => {
                  const isImage = att.mimetype?.startsWith("image/");
                  const isVideo = att.mimetype?.startsWith("video/");
                  return (
                    <div key={att.id} className="relative aspect-square rounded-xl overflow-hidden border border-dx-line group bg-black/20">
                      {isVideo ? (
                        <video src={`/${att.filepath}`} controls playsInline className="w-full h-full object-cover" />
                      ) : (
                        <a href={`/${att.filepath}`} target="_blank" rel="noopener noreferrer">
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/${att.filepath}`} alt={att.filename} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-dx-ink-faint">
                              <FileUp className="w-7 h-7" />
                            </div>
                          )}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadFile(`/${att.filepath}`, att.filename)}
                        title="Save copy to device"
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {!isQuoted && (
                        <button
                          onClick={() => handleDeletePhoto(att.id)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          {visit.notes && (
            <div className="dx-card p-5">
              <p className="text-xs font-semibold text-dx-ink-faint uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-dx-ink whitespace-pre-wrap">{visit.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="dx-card p-5 space-y-3 text-sm">
            <div>
              <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Title</p>
              <p className="font-medium text-dx-ink">{visit.title}</p>
            </div>
            <div>
              <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Company</p>
              <p className="font-medium text-dx-ink">{visit.company?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Customer</p>
              {visit.customer ? (
                <Link href={`/customers/${visit.customer.id}`} className="font-medium text-dx-accent hover:opacity-80">
                  {visit.customer.name}
                </Link>
              ) : (
                <p className="font-medium text-dx-ink">{visit.contactName ?? "New prospect"}</p>
              )}
              {visit.contactPhone && (
                <p className="text-dx-ink-muted flex items-center gap-1.5 mt-1">
                  <Phone className="w-3 h-3" /> {visit.contactPhone}
                </p>
              )}
            </div>
            {visit.location && (
              <div>
                <p className="text-dx-ink-faint text-xs uppercase tracking-wide font-medium mb-1">Location</p>
                <p className="font-medium text-dx-ink flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-dx-ink-faint" /> {visit.location}
                </p>
              </div>
            )}
          </div>

          <div className="dx-card p-5 text-xs text-dx-ink-faint space-y-1">
            <p>Captured by <span className="text-dx-ink font-medium">{visit.createdBy.name}</span></p>
            <p>Created {formatDate(visit.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
