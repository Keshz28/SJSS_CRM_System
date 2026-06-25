"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  order: number;
}

interface Customer { id: string; name: string; contactPerson: string | null }
interface Company { id: string; name: string; prefix: string }

interface QuotationFormData {
  id?: string;
  quotationNumber?: string;
  customerId: string;
  companyId: string;
  subject: string;
  notes: string;
  terms: string;
  validUntil: string;
  status?: string;
  items: LineItem[];
}

interface Props {
  customers: Customer[];
  companies: Company[];
  defaultValues?: Partial<QuotationFormData>;
  preselectedCustomerId?: string;
}

const DEFAULT_TERMS = `1. Prices quoted are valid for 30 days from the date of this quotation.
2. Delivery timeline will be confirmed upon order acceptance.
3. Payment terms: 50% deposit upon confirmation, balance upon delivery.
4. All prices are in Malaysian Ringgit (MYR).`;

const fieldCls = "w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent transition-colors";
const labelCls = "block text-sm font-medium text-dx-ink-muted mb-1.5";

export function QuotationForm({ customers, companies, defaultValues, preselectedCustomerId }: Props) {
  const router = useRouter();
  const isEdit = !!defaultValues?.id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [companyId, setCompanyId] = useState(defaultValues?.companyId ?? companies[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(defaultValues?.customerId ?? preselectedCustomerId ?? "");
  const [subject, setSubject] = useState(defaultValues?.subject ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [terms, setTerms] = useState(defaultValues?.terms ?? DEFAULT_TERMS);
  const [validUntil, setValidUntil] = useState(defaultValues?.validUntil ? defaultValues.validUntil.split("T")[0] : "");
  const [items, setItems] = useState<LineItem[]>(
    defaultValues?.items?.length
      ? defaultValues.items
      : [{ description: "", quantity: 1, unitPrice: 0, order: 0 }]
  );

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, order: prev.length }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })));
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) { setError("Please select which company this quotation is for."); return; }
    if (!customerId) { setError("Please select a customer."); return; }
    if (items.some((i) => !i.description.trim())) { setError("All line items must have a description."); return; }

    setSaving(true);
    setError("");

    const url = isEdit ? `/api/quotations/${defaultValues!.id}` : "/api/quotations";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId, customerId, subject, notes, terms,
        validUntil: validUntil || null,
        items: items.map((item, i) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          order: i,
        })),
      }),
    });

    setSaving(false);
    if (!res.ok) { setError("Failed to save quotation. Please check all fields."); return; }
    const saved = await res.json();
    router.push(`/quotations/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/quotations" className="dx-btn-ghost p-2.5">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-lg font-semibold text-dx-ink">
            {isEdit ? `Edit ${defaultValues?.quotationNumber}` : "New Quotation"}
          </h2>
          <p className="text-xs text-dx-ink-faint">
            {isEdit ? "Update quotation details" : "Quotation number will be auto-generated"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="dx-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-dx-ink border-b border-dx-line pb-3">
              Quotation Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Company <span className="text-dx-danger">*</span></label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={fieldCls} required disabled={isEdit}>
                  <option value="">Select a company…</option>
                  {companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
                </select>
                <p className="text-xs text-dx-ink-faint mt-1.5">
                  {isEdit ? "Company can't be changed after creation." : "Which company is issuing this quotation."}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Customer <span className="text-dx-danger">*</span></label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={fieldCls} required>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.contactPerson ? ` — ${c.contactPerson}` : ""}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Subject / Title</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldCls} placeholder="e.g., Supply of Office Furniture" />
              </div>
              <div>
                <label className={labelCls}>Valid Until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="dx-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-dx-ink border-b border-dx-line pb-3">Line Items</h3>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-6">
                    <input type="text" value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} placeholder={`Item ${index + 1} description`} className={fieldCls + " text-sm"} required />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)} min="0" step="0.01" className={fieldCls + " text-sm text-right"} placeholder="Qty" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input type="number" value={item.unitPrice} onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)} min="0" step="0.01" className={fieldCls + " text-sm text-right"} placeholder="Price" />
                  </div>
                  <div className="col-span-3 sm:col-span-1 text-right text-sm font-semibold text-dx-ink">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1} className="p-1.5 rounded-lg hover:bg-dx-danger/10 text-dx-ink-faint hover:text-dx-danger disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="flex items-center gap-2 text-sm text-dx-accent hover:opacity-80 font-medium mt-2 transition-opacity">
              <Plus className="w-4 h-4" />
              Add line item
            </button>
          </div>

          {/* Notes & Terms */}
          <div className="dx-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-dx-ink border-b border-dx-line pb-3">Notes & Terms</h3>
            <div>
              <label className={labelCls}>Notes to Customer</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldCls + " resize-none"} rows={3} placeholder="Any notes that will appear on the quotation PDF…" />
            </div>
            <div>
              <label className={labelCls}>Terms & Conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} className={fieldCls + " resize-none"} rows={5} />
            </div>
          </div>
        </div>

        {/* Right: Summary */}
        <div>
          <div className="dx-card p-5 sticky top-20">
            <h3 className="text-sm font-semibold text-dx-ink border-b border-dx-line pb-3 mb-4">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-dx-ink-muted">
                <span>Items</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-dx-line pt-3 mt-3">
                <span className="text-dx-ink">Total</span>
                <span className="text-dx-accent">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {error && (
              <p className="text-xs text-dx-danger bg-dx-danger/10 border border-dx-danger/30 rounded-xl px-3 py-2 mt-4">
                {error}
              </p>
            )}

            <div className="mt-6 space-y-2">
              <button type="submit" disabled={saving} className="dx-btn-gradient w-full">
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Quotation"}
              </button>
              <Link href="/quotations" className="dx-btn-ghost w-full text-center block">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
