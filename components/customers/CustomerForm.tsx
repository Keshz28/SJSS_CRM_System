"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useCompanyScope } from "@/components/layout/CompanyScopeProvider";

interface CustomerData {
  companyId: string; name: string; contactPerson: string; email: string;
  phone: string; address: string; city: string; notes: string;
}
interface Props {
  customerId?: string;
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
  defaultValues?: Partial<CustomerData>;
}
const fieldCls = "w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink";
const labelCls = "block text-sm font-medium text-dx-ink-muted mb-1.5";

export function CustomerForm({ customerId, companies, defaultCompanyId, defaultValues }: Props) {
  const router = useRouter();
  const id = useId();
  const { companyId: selectedCompanyId } = useCompanyScope();
  const isEdit = !!customerId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CustomerData>({
    companyId: defaultValues?.companyId || defaultCompanyId || "",
    name: defaultValues?.name ?? "", contactPerson: defaultValues?.contactPerson ?? "",
    email: defaultValues?.email ?? "", phone: defaultValues?.phone ?? "",
    address: defaultValues?.address ?? "", city: defaultValues?.city ?? "", notes: defaultValues?.notes ?? "",
  });
  useEffect(() => {
    if (!isEdit && selectedCompanyId) setForm((v) => ({ ...v, companyId: selectedCompanyId }));
  }, [selectedCompanyId, isEdit]);
  function set(field: keyof CustomerData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const res = await fetch(isEdit ? `/api/customers/${customerId}` : "/api/customers", {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : Object.values(data.error?.fieldErrors || {}).flat().join(" ") || "Failed to save customer.");
      router.push("/customers"); router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/customers" className="dx-btn-ghost p-2.5" aria-label="Back to customers"><ArrowLeft className="w-4 h-4" /></Link>
        <h2 className="text-lg font-semibold text-dx-ink">{isEdit ? "Edit Customer" : "New Customer"}</h2>
      </div>
      <fieldset disabled={saving} className="dx-card p-5 space-y-4">
        <label className={labelCls} htmlFor={`${id}-company`}>CRM company *</label>
        <select id={`${id}-company`} className={fieldCls} value={form.companyId} onChange={(e) => set("companyId", e.target.value)} required disabled={Boolean(defaultValues?.companyId) || (!isEdit && Boolean(selectedCompanyId))}>
          <option value="">Choose a company…</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="text-xs text-dx-ink-faint">This customer belongs to this company. Use a separate customer record if they work with both companies.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ["name", "Company / Customer Name", "text", 200], ["contactPerson", "Contact Person", "text", 200],
            ["email", "Email", "email", 254], ["phone", "Phone", "tel", 80], ["city", "City", "text", 200],
          ] as const).map(([key, label, type, max]) => (
            <div key={key} className={key === "name" ? "sm:col-span-2" : ""}>
              <label htmlFor={`${id}-${key}`} className={labelCls}>{label}{key === "name" ? " *" : ""}</label>
              <input id={`${id}-${key}`} type={type} value={form[key]} onChange={(e) => set(key, e.target.value)} className={fieldCls} maxLength={max} required={key === "name"} />
            </div>
          ))}
          {([ ["address", "Address", 1000], ["notes", "Notes (internal)", 5000] ] as const).map(([key, label, max]) => (
            <div key={key} className="sm:col-span-2">
              <label htmlFor={`${id}-${key}`} className={labelCls}>{label}</label>
              <textarea id={`${id}-${key}`} value={form[key]} onChange={(e) => set(key, e.target.value)} className={fieldCls} maxLength={max} rows={3} />
            </div>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-dx-danger">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="dx-btn-gradient"><Save className="w-4 h-4" />{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}</button>
        <Link href="/customers" className="dx-btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
