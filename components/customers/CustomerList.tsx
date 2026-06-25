"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import {
  Search,
  Plus,
  Users,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  UserPlus,
  FileText,
  Sparkles,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  createdAt: Date;
  _count: { quotations: number };
}

interface Stats {
  totalCustomers: number;
  withQuotes: number;
  totalQuotes: number;
  newThisMonth: number;
}

interface Props {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  search: string;
  stats: Stats;
}

const AVATAR_GRADIENTS = [
  "from-[#CB3CFF] to-[#7F4BFF]",
  "from-[#00C2FF] to-[#0078FF]",
  "from-[#14CA74] to-[#05C168]",
  "from-[#FDB52A] to-[#FF8A3C]",
  "from-[#FF5A65] to-[#FF3C8A]",
  "from-[#9A91FB] to-[#5B5BFF]",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function CustomerList({
  customers,
  total,
  page,
  limit,
  search,
  stats,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(search);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(total / limit);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (searchValue) params.set("search", searchValue);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Archive customer "${name}"? Their quotations will remain.`))
      return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const statCards = [
    {
      label: "Total Customers",
      value: stats.totalCustomers,
      icon: Users,
      tint: "from-[#A855F7] to-[#6366F1]",   // violet → indigo
    },
    {
      label: "New This Month",
      value: stats.newThisMonth,
      icon: UserPlus,
      tint: "from-[#0EA5E9] to-[#14B8A6]",   // sky → teal
    },
    {
      label: "With Quotations",
      value: stats.withQuotes,
      icon: Sparkles,
      tint: "from-[#10B981] to-[#84CC16]",   // emerald → lime
    },
    {
      label: "Total Quotations",
      value: stats.totalQuotes,
      icon: FileText,
      tint: "from-[#F59E0B] to-[#F97316]",   // amber → orange
    },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dx-ink-faint" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search customers…"
            className="dx-input"
          />
        </form>
        <div className="flex-1 hidden sm:block" />
        <Link href="/customers/new" className="dx-btn-gradient">
          <Plus className="w-4 h-4" />
          Add Customer
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="dx-card p-4 flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.tint} flex items-center justify-center flex-shrink-0 shadow-lg`}
            >
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-dx-ink-muted truncate">{s.label}</p>
              <p className="text-xl font-semibold text-dx-ink">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="dx-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dx-line">
          <h2 className="text-base font-semibold text-dx-ink">All Customers</h2>
          <p className="text-sm text-dx-ink-muted">
            <span className="text-dx-accent font-medium">
              {from}–{to}
            </span>{" "}
            of {total}
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-dx-ink-faint mx-auto mb-3" />
            <p className="text-dx-ink-muted text-sm">
              {search
                ? `No customers found for "${search}"`
                : "No customers yet."}
            </p>
            {!search && (
              <Link
                href="/customers/new"
                className="dx-btn-gradient inline-flex mt-4"
              >
                Add first customer
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dx-line">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide hidden md:table-cell">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide hidden lg:table-cell">
                    City
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">
                    Quotes
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide hidden sm:table-cell">
                    Added
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr
                    key={c.id}
                    className="border-b border-dx-line last:border-0 hover:bg-dx-surface-hover transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/customers/${c.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <span
                          className={`w-9 h-9 rounded-full bg-gradient-to-br ${
                            AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]
                          } flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
                        >
                          {initials(c.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium text-dx-ink group-hover:text-dx-accent transition-colors truncate">
                            {c.name}
                          </span>
                          {c.contactPerson && (
                            <span className="block text-xs text-dx-ink-faint truncate">
                              {c.contactPerson}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="text-dx-ink-muted truncate">
                        {c.email ?? "—"}
                      </p>
                      {c.phone && (
                        <p className="text-xs text-dx-ink-faint">{c.phone}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-dx-ink-muted">
                      {c.city ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-dx-accent/15 text-dx-accent text-xs font-semibold">
                        {c._count.quotations}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-dx-ink-faint hidden sm:table-cell text-xs">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/customers/${c.id}`}
                          className="p-1.5 rounded-lg hover:bg-dx-accent/10 text-dx-ink-faint hover:text-dx-accent transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1.5 rounded-lg hover:bg-dx-danger/10 text-dx-ink-faint hover:text-dx-danger transition-colors"
                          title="Archive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-dx-line">
            <p className="text-sm text-dx-ink-muted">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex gap-1.5">
              <Link
                href={`?${new URLSearchParams({
                  ...(search && { search }),
                  page: String(page - 1),
                })}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 transition-colors ${
                  page === 1 ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <Link
                href={`?${new URLSearchParams({
                  ...(search && { search }),
                  page: String(page + 1),
                })}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 transition-colors ${
                  page === totalPages ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {isPending && (
        <p className="text-xs text-dx-ink-faint text-center">Searching…</p>
      )}
    </div>
  );
}
