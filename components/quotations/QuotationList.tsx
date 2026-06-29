"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate, dxStatusColor, statusLabel } from "@/lib/utils";
import {
  Search, Plus, FileText, ChevronLeft, ChevronRight,
  Eye, Trash2, Paperclip, Upload,
} from "lucide-react";

interface Company { id: string; name: string; prefix: string }

interface Quotation {
  id: string;
  quotationNumber: string;
  subject: string | null;
  status: string;
  totalAmount: unknown;
  createdAt: Date;
  customer: { id: string; name: string };
  company: Company | null;
  _count: { items: number; attachments: number };
}

interface Props {
  quotations: Quotation[];
  total: number;
  page: number;
  limit: number;
  search: string;
  status: string;
  /** Whether to render the Company column (only in the combined "All companies" view). */
  showCompanyColumn: boolean;
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
];

export function QuotationList({ quotations, total, page, limit, search, status, showCompanyColumn }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(search);
  const [, startTransition] = useTransition();
  const totalPages = Math.ceil(total / limit);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  function navigate(params: Record<string, string>) {
    startTransition(() => {
      const p = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
      router.push(`${pathname}?${p.toString()}`);
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ search: searchValue, status });
  }

  async function handleDelete(id: string, num: string) {
    if (!confirm(`Delete quotation ${num}? This cannot be undone.`)) return;
    await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dx-ink-faint" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search quotations…"
            className="dx-input"
          />
        </form>
        <div className="flex-1" />
        <Link href="/quotations/import" className="dx-btn-ghost">
          <Upload className="w-4 h-4" />
          Upload
        </Link>
        <Link href="/quotations/new" className="dx-btn-gradient">
          <Plus className="w-4 h-4" />
          New Quotation
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-dx-surface border border-dx-line rounded-xl p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => navigate({ search, status: tab.value })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === tab.value
                ? "bg-gradient-to-r from-dx-accent to-dx-accent-2 text-white"
                : "text-dx-ink-muted hover:text-dx-ink hover:bg-dx-surface-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="dx-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-dx-line">
          <h2 className="text-base font-semibold text-dx-ink">All Quotations</h2>
          <p className="text-sm text-dx-ink-muted">
            <span className="text-dx-accent font-medium">{from}–{to}</span> of {total}
          </p>
        </div>

        {quotations.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-dx-ink-faint mx-auto mb-3" />
            <p className="text-dx-ink-muted text-sm">
              {search || status ? "No quotations match your filters." : "No quotations yet."}
            </p>
            {!search && !status && (
              <Link href="/quotations/new" className="dx-btn-gradient inline-flex mt-4">
                Create first quotation
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dx-line">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Quote No.</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Customer</th>
                  {showCompanyColumn && (
                    <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide hidden lg:table-cell">Company</th>
                  )}
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide hidden md:table-cell">Subject</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-dx-ink-faint uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-dx-ink-faint uppercase tracking-wide hidden sm:table-cell">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q.id} className="border-b border-dx-line last:border-0 hover:bg-dx-surface-hover transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-dx-accent">
                          {q.quotationNumber}
                        </span>
                        {q._count.attachments > 0 && (
                          <span title={`${q._count.attachments} attachment(s)`}>
                            <Paperclip className="w-3 h-3 text-dx-ink-faint" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-dx-ink">{q.customer.name}</td>
                    {showCompanyColumn && (
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {q.company ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-dx-accent/10 text-dx-accent">
                            {q.company.name}
                          </span>
                        ) : (
                          <span className="text-dx-ink-faint">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-dx-ink-muted hidden md:table-cell max-w-[180px] truncate">
                      {q.subject ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${dxStatusColor(q.status)}`}>
                        {statusLabel(q.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-dx-ink">
                      {formatCurrency(Number(q.totalAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-dx-ink-faint hidden sm:table-cell">
                      {formatDate(q.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/quotations/${q.id}`}
                          className="p-1.5 rounded-lg hover:bg-dx-accent/10 text-dx-ink-faint hover:text-dx-accent transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(q.id, q.quotationNumber)}
                          className="p-1.5 rounded-lg hover:bg-dx-danger/10 text-dx-ink-faint hover:text-dx-danger transition-colors"
                          title="Delete"
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-dx-line">
            <p className="text-sm text-dx-ink-muted">
              Showing {from}–{to} of {total}
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => navigate({ search, status, page: String(page - 1) })}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate({ search, status, page: String(page + 1) })}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
