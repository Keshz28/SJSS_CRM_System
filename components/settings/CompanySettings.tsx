"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Save, CheckCircle, AlertCircle } from "lucide-react";

export interface CompanyRecord {
  id: string; name: string; prefix: string; legalName: string | null;
  tagline: string | null; registrationNo: string | null; address: string | null;
  city: string | null; phone: string | null; email: string | null;
  website: string | null; logoUrl: string | null;
}

const FIELDS: { key: keyof Omit<CompanyRecord, "id">; label: string; placeholder?: string; full?: boolean; hint?: string }[] = [
  { key: "name", label: "Display Name", placeholder: "e.g. SJ Sunrise Services" },
  { key: "prefix", label: "Quote Prefix", placeholder: "e.g. SJSS", hint: "Used in quote numbers, e.g. SJSS-2026-0001" },
  { key: "legalName", label: "Legal / Registered Name", placeholder: "Full registered business name", full: true },
  { key: "tagline", label: "Tagline", placeholder: "e.g. Professional Services" },
  { key: "registrationNo", label: "Registration No.", placeholder: "e.g. 202301234567 (SSM)" },
  { key: "address", label: "Address", placeholder: "Street address", full: true },
  { key: "city", label: "City / Postcode", placeholder: "e.g. 50450 Kuala Lumpur" },
  { key: "phone", label: "Phone", placeholder: "e.g. +60 3-1234 5678" },
  { key: "email", label: "Email", placeholder: "e.g. info@company.com" },
  { key: "website", label: "Website", placeholder: "e.g. www.company.com" },
  { key: "logoUrl", label: "Logo URL", placeholder: "Link to a logo image (optional)", full: true },
];

const fieldCls = "w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent transition-colors";
const labelCls = "block text-sm font-medium text-dx-ink-muted mb-1.5";

function CompanyCard({ company }: { company: CompanyRecord }) {
  const router = useRouter();
  const [form, setForm] = useState<CompanyRecord>(company);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof CompanyRecord, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, prefix: form.prefix, legalName: form.legalName ?? "",
        tagline: form.tagline ?? "", registrationNo: form.registrationNo ?? "",
        address: form.address ?? "", city: form.city ?? "", phone: form.phone ?? "",
        email: form.email ?? "", website: form.website ?? "", logoUrl: form.logoUrl ?? "",
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save changes — please check the fields.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="dx-card p-5 space-y-4">
      <div className="flex items-center gap-3 border-b border-dx-line pb-4">
        <div className="w-10 h-10 rounded-xl bg-dx-accent/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-dx-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-dx-ink">{company.name}</h3>
          <p className="text-xs text-dx-ink-faint">Prefix <span className="font-mono text-dx-accent">{company.prefix}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <div key={field.key} className={field.full ? "sm:col-span-2" : undefined}>
            <label className={labelCls}>{field.label}</label>
            <input
              type="text"
              value={(form[field.key] as string | null) ?? ""}
              onChange={(e) => update(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={fieldCls}
              required={field.key === "name" || field.key === "prefix"}
            />
            {field.hint && <p className="text-xs text-dx-ink-faint mt-1">{field.hint}</p>}
          </div>
        ))}
      </div>

      {error && (
        <p className="flex items-center gap-2 text-xs text-dx-danger bg-dx-danger/10 border border-dx-danger/30 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="dx-btn-gradient">
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-[#14CA74] font-medium">
            <CheckCircle className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

export function CompanySettings({ companies }: { companies: CompanyRecord[] }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-dx-ink-muted">
        These details appear on each company&apos;s quotation PDFs. Changes apply to new and existing quotations.
      </p>
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} />
      ))}
    </div>
  );
}
