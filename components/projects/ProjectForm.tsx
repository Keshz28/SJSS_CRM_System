"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCompanyScope } from "@/components/layout/CompanyScopeProvider";
import { projectStatuses } from "@/lib/project-schema";
interface ProjectValues {
  id?: string;
  name: string;
  companyId: string;
  customerId?: string | null;
  location?: string | null;
  description?: string | null;
  status: string;
}
const field =
  "mt-1.5 w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-3 text-sm text-dx-ink";
export function ProjectForm({
  companies,
  customers,
  initial,
}: {
  companies: { id: string; name: string }[];
  customers: { id: string; name: string; companyId: string | null }[];
  initial?: ProjectValues;
}) {
  const router = useRouter();
  const { companyId: selectedCompanyId } = useCompanyScope();
  const [values, setValues] = useState({
    name: initial?.name || "",
    companyId: initial?.companyId || companies[0]?.id || "",
    customerId: initial?.customerId || "",
    location: initial?.location || "",
    description: initial?.description || "",
    status: initial?.status || "PLANNED",
  });
  useEffect(() => {
    if (!initial?.id && selectedCompanyId) setValues((v) => ({ ...v, companyId: selectedCompanyId, customerId: "" }));
  }, [selectedCompanyId, initial?.id]);
  const [busy, setBusy] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "", contactPerson: "", phone: "", email: "", address: "", city: "", notes: "",
  });
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        initial?.id ? `/api/projects/${initial.id}` : "/api/projects",
        {
          method: initial?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            customerId: addingCustomer ? null : values.customerId || null,
            ...(addingCustomer && { newCustomer }),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save the project.");
      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="dx-card p-4 sm:p-6 space-y-5 max-w-2xl">
      <p className="text-sm text-dx-ink-muted">
        One project keeps a job&apos;s site updates, photos, recordings and
        quotations together.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm text-dx-ink-muted">
          Project name
          <input
            required
            maxLength={160}
            className={field}
            placeholder="e.g. Klang shoplot renovation"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
        </label>
        <label className="block text-sm text-dx-ink-muted">
          Company
          <select
            aria-label="Company"
            disabled={Boolean(initial?.id || selectedCompanyId)}
            className={field}
            value={values.companyId}
            onChange={(e) =>
              setValues((v) => ({ ...v, companyId: e.target.value, customerId: "" }))
            }
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!initial?.id && (
          <div className="flex gap-2 flex-wrap" role="group" aria-label="Customer entry">
            <button type="button" className="dx-btn-ghost min-h-11" aria-pressed={!addingCustomer} onClick={() => setAddingCustomer(false)}>
              Choose existing customer
            </button>
            <button type="button" className="dx-btn-ghost min-h-11" aria-pressed={addingCustomer} onClick={() => setAddingCustomer(true)}>
              Add new customer
            </button>
          </div>
        )}
        {addingCustomer ? (
          <fieldset className="rounded-xl border border-dx-line p-4 space-y-3">
            <legend className="text-sm font-medium text-dx-ink px-1">New customer</legend>
            <p className="text-xs text-dx-ink-muted">Saved to {companies.find((c) => c.id === values.companyId)?.name} when you create this project.</p>
            {([
              ["name", "Customer name", "text"],
              ["contactPerson", "Contact person", "text"],
              ["phone", "Customer phone", "tel"],
              ["email", "Customer email", "email"],
              ["address", "Customer address", "text"],
              ["city", "Customer city", "text"],
            ] as const).map(([key, label, type]) => (
              <label key={key} className="block text-sm text-dx-ink-muted">
                {label}{key === "name" ? " *" : ""}
                <input type={type} required={key === "name"} maxLength={key === "address" ? 1000 : key === "phone" ? 80 : 200} className={field} value={newCustomer[key]} onChange={(e) => setNewCustomer((c) => ({ ...c, [key]: e.target.value }))} />
              </label>
            ))}
          </fieldset>
        ) : (
        <label className="block text-sm text-dx-ink-muted">
          Customer
          <select
            aria-label="Customer"
            className={field}
            value={values.customerId}
            onChange={(e) =>
              setValues((v) => ({ ...v, customerId: e.target.value }))
            }
          >
            <option value="">Link a customer later</option>
            {customers.filter((c) => c.companyId === values.companyId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        )}
        <label className="block text-sm text-dx-ink-muted">
          Site address
          <input
            className={field}
            maxLength={500}
            value={values.location}
            onChange={(e) =>
              setValues((v) => ({ ...v, location: e.target.value }))
            }
          />
        </label>
        <label className="block text-sm text-dx-ink-muted">
          Stage
          <select
            className={field}
            value={values.status}
            onChange={(e) =>
              setValues((v) => ({ ...v, status: e.target.value }))
            }
          >
            {Object.entries(projectStatuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-dx-ink-muted">
          Project notes
          <textarea
            className={field}
            rows={4}
            maxLength={5000}
            value={values.description}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
            placeholder="Scope of work and useful site information"
          />
        </label>
      </fieldset>
      <div className="flex gap-3 flex-wrap">
        <button disabled={busy} className="dx-btn-gradient min-h-11">
          {busy ? "Saving…" : initial?.id ? "Save project" : "Create project"}
        </button>
        <Link
          href={initial?.id ? "/projects" : "/projects"}
          className="dx-btn-ghost min-h-11"
        >
          Back to projects
        </Link>
      </div>
    </form>
  );
}
