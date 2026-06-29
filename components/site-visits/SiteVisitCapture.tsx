"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, Save, X, ImagePlus, Video } from "lucide-react";

interface Customer { id: string; name: string }
interface Company { id: string; name: string; prefix: string }

interface Props {
  customers: Customer[];
  companies: Company[];
  /** Active global company scope; preselects the company on a new visit. */
  defaultCompanyId?: string;
}

const fieldCls =
  "w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent transition-colors";
const labelCls = "block text-sm font-medium text-dx-ink-muted mb-1.5";

interface Shot {
  file: File;
  url: string;
}

export function SiteVisitCapture({ customers, companies, defaultCompanyId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyId, setCompanyId] = useState(defaultCompanyId ?? companies[0]?.id ?? "");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [customerId, setCustomerId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setShots((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  function removeShot(index: number) {
    setShots((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) { setError("Please choose which company this visit is for."); return; }
    if (!title.trim()) { setError("Please add a short title so you can find this later."); return; }
    if (mode === "existing" && !customerId) { setError("Please pick the customer, or switch to New prospect."); return; }

    setSaving(true);
    setError("");

    try {
      setProgress("Saving visit…");
      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          title: title.trim(),
          customerId: mode === "existing" ? customerId : null,
          contactName: mode === "new" ? contactName.trim() : null,
          contactPhone: mode === "new" ? contactPhone.trim() : null,
          location: location.trim(),
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.formErrors?.join(", ") || data.error || "Could not save the visit.");
      }

      const { id } = await res.json();

      // Upload the photos one by one onto the new visit.
      for (let i = 0; i < shots.length; i++) {
        setProgress(`Uploading ${i + 1} of ${shots.length}…`);
        const fd = new FormData();
        fd.append("file", shots[i].file);
        fd.append("siteVisitId", id);
        const up = await fetch("/api/uploads", { method: "POST", body: fd });
        if (!up.ok) {
          const d = await up.json().catch(() => ({}));
          throw new Error(d.error || `Photo ${i + 1} failed to upload.`);
        }
      }

      router.push(`/site-visits/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
      setProgress("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/site-visits" className="dx-btn-ghost p-2.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <p className="text-sm text-dx-ink-muted">Capture a site visit, then turn it into a quote later.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-[#FF5A65]/15 border border-[#FF5A65]/30 text-[#FF5A65] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Photos — the main event, kept at the top for on-site use */}
      <div className="dx-card p-5">
        <label className={labelCls}>Photos &amp; Videos</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleAddPhotos}
        />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {shots.map((shot, i) => {
            const isVideo = shot.file.type.startsWith("video/");
            return (
            <div key={shot.url} className="relative aspect-square rounded-xl overflow-hidden border border-dx-line group bg-black/20">
              {isVideo ? (
                <video src={shot.url} muted playsInline className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shot.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              )}
              {isVideo && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium flex items-center gap-1">
                  <Video className="w-3 h-3" /> Video
                </span>
              )}
              <button
                type="button"
                onClick={() => removeShot(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            );
          })}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-dx-line text-dx-ink-faint hover:border-dx-accent hover:text-dx-accent transition-colors flex flex-col items-center justify-center gap-1"
          >
            {shots.length === 0 ? <Camera className="w-6 h-6" /> : <ImagePlus className="w-6 h-6" />}
            <span className="text-[11px] font-medium">{shots.length === 0 ? "Take / Add" : "Add more"}</span>
          </button>
        </div>
        {shots.length > 0 && (
          <p className="text-xs text-dx-ink-faint mt-2">{shots.length} item{shots.length !== 1 ? "s" : ""} ready</p>
        )}
      </div>

      {/* Details */}
      <div className="dx-card p-5 space-y-4">
        <div>
          <label className={labelCls}>Title <span className="text-[#FF5A65]">*</span></label>
          <input
            className={fieldCls}
            placeholder="e.g. Shoplot renovation, Klang"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Company <span className="text-[#FF5A65]">*</span></label>
          <select className={fieldCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Customer vs new prospect */}
        <div>
          <label className={labelCls}>Customer</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium border transition-colors ${
                mode === "new"
                  ? "bg-dx-accent/15 border-dx-accent/40 text-dx-accent"
                  : "border-dx-line text-dx-ink-muted hover:text-dx-ink"
              }`}
            >
              New prospect
            </button>
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium border transition-colors ${
                mode === "existing"
                  ? "bg-dx-accent/15 border-dx-accent/40 text-dx-accent"
                  : "border-dx-line text-dx-ink-muted hover:text-dx-ink"
              }`}
            >
              Existing customer
            </button>
          </div>

          {mode === "existing" ? (
            <select className={fieldCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className={fieldCls}
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <input
                className={fieldCls}
                placeholder="Phone (+60…)"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Location</label>
          <input
            className={fieldCls}
            placeholder="Site address or area"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            className={`${fieldCls} min-h-[140px] resize-y`}
            placeholder="Everything you'd normally type into WhatsApp — measurements, what the customer wants, materials, anything for the quote…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="dx-btn-gradient disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? (progress || "Saving…") : "Save Visit"}
        </button>
        <Link href="/site-visits" className="dx-btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
