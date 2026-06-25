"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface CustomerData {
  name: string; contactPerson: string; email: string;
  phone: string; address: string; city: string; notes: string;
}

interface Props {
  customerId?: string;
  defaultValues?: Partial<CustomerData>;
}

const fieldCls = "w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent transition-colors";
const labelCls = "block text-sm font-medium text-dx-ink-muted mb-1.5";

export function CustomerForm({ customerId, defaultValues }: Props) {
  const router = useRouter();
  const isEdit = !!customerId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<CustomerData>({
    name: defaultValues?.name ?? "",
    contactPerson: defaultValues?.contactPerson ?? "",
    email: defaultValues?.email ?? "",
    phone: defaultValues?.phone ?? "",
    address: defaultValues?.address ?? "",
    city: defaultValues?.city ?? "",
    notes: defaultValues?.notes ?? "",
  });

  function set(field: keyof CustomerData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = isEdit ? `/api/customers/${customerId}` : "/api/customers";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.fieldErrors?.name?.[0] ?? "Failed to save customer.");
      return;
    }
    router.push("/customers");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/customers" className="dx-btn-ghost p-2.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h2 className="text-lg font-semibold text-dx-ink">
          {isEdit ? "Edit Customer" : "New Customer"}
        </h2>
      </div>

      <div className="dx-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-dx-ink border-b border-dx-line pb-3">Company Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Company / Customer Name <span className="text-dx-danger">*</span></label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldCls} placeholder="ABC Sdn Bhd" required />
          </div>
          <div>
            <label className={labelCls}>Contact Person</label>
            <input type="text" value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} className={fieldCls} placeholder="John Doe" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={fieldCls} placeholder="contact@abc.com" />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={fieldCls} placeholder="+60 12-345 6789" />
          </div>
          <div>
            <label className={labelCls}>City</label>
            <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)} className={fieldCls} placeholder="Kuala Lumpur" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Address</label>
            <textarea value={form.address} onChange={(e) => set("address", e.target.value)} className={fieldCls + " resize-none"} rows={3} placeholder="No. 1, Jalan Example, 50000 Kuala Lumpur" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes (internal)</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={fieldCls + " resize-none"} rows={2} placeholder="Any internal notes about this customer…" />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-dx-danger bg-dx-danger/10 border border-dx-danger/30 rounded-xl px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="dx-btn-gradient">
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Customer"}
        </button>
        <Link href="/customers" className="dx-btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
