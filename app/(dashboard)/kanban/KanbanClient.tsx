"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface KanbanQuote {
  id: string;
  quotationNumber: string;
  subject: string | null;
  totalAmount: number;
  createdAt: string;
  customer: { name: string };
  company: { name: string } | null;
}

interface Props {
  draft: KanbanQuote[];
  sent: KanbanQuote[];
  accepted: KanbanQuote[];
  rejected: KanbanQuote[];
}

const COLUMNS = [
  { key: "draft" as const, label: "Draft", color: "#AEB9E1", bg: "bg-[#AEB9E1]/10", border: "border-[#AEB9E1]/20" },
  { key: "sent" as const, label: "Sent", color: "#00C2FF", bg: "bg-[#00C2FF]/10", border: "border-[#00C2FF]/20" },
  { key: "accepted" as const, label: "Accepted", color: "#14CA74", bg: "bg-[#14CA74]/10", border: "border-[#14CA74]/20" },
  { key: "rejected" as const, label: "Rejected", color: "#FF5A65", bg: "bg-[#FF5A65]/10", border: "border-[#FF5A65]/20" },
];

const STATUS_MAP: Record<string, string> = {
  draft: "SENT",
  sent: "ACCEPTED",
};

function QuoteCard({ quote, canAdvance, onAdvance }: { quote: KanbanQuote; canAdvance: boolean; onAdvance: () => void }) {
  return (
    <div className="dx-card p-4 space-y-2.5 group">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-dx-accent">{quote.quotationNumber}</span>
        <Link href={`/quotations/${quote.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity text-dx-ink-faint hover:text-dx-ink">
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
      <p className="text-sm font-medium text-dx-ink line-clamp-2">{quote.customer.name}</p>
      {quote.subject && <p className="text-xs text-dx-ink-faint line-clamp-1">{quote.subject}</p>}
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-semibold text-dx-ink">{formatCurrency(quote.totalAmount)}</span>
        <span className="text-xs text-dx-ink-faint">{formatDate(quote.createdAt)}</span>
      </div>
      {canAdvance && (
        <button
          onClick={onAdvance}
          className="w-full mt-1 py-1.5 rounded-lg text-xs font-medium bg-dx-accent/10 text-dx-accent hover:bg-dx-accent/20 transition-colors"
        >
          Move to {quote.quotationNumber ? (STATUS_MAP[quote.id] ? "Sent" : "Next") : "Next"} →
        </button>
      )}
    </div>
  );
}

export function KanbanClient({ draft, sent, accepted, rejected }: Props) {
  const router = useRouter();
  const [moving, setMoving] = useState<string | null>(null);

  const dataMap = { draft, sent, accepted, rejected };

  const ADVANCE_STATUS: Record<string, string> = {
    draft: "SENT",
    sent: "ACCEPTED",
  };

  async function advance(quoteId: string, fromCol: string) {
    const newStatus = ADVANCE_STATUS[fromCol];
    if (!newStatus) return;
    setMoving(quoteId);
    await fetch(`/api/quotations/${quoteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setMoving(null);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
      {COLUMNS.map((col) => {
        const quotes = dataMap[col.key];
        return (
          <div key={col.key} className={`dx-card overflow-hidden`}>
            {/* Column header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-dx-line ${col.bg}`}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <span className="text-sm font-semibold text-dx-ink">{col.label}</span>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${col.color}20`, color: col.color }}>
                {quotes.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-3 space-y-3 min-h-[120px]">
              {quotes.length === 0 ? (
                <p className="text-xs text-dx-ink-faint text-center py-6">No quotes here</p>
              ) : (
                quotes.map((q) => (
                  <div key={q.id} className={moving === q.id ? "opacity-50 pointer-events-none" : ""}>
                    <div className="dx-card p-4 space-y-2.5 group">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-dx-accent">{q.quotationNumber}</span>
                        <Link href={`/quotations/${q.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity text-dx-ink-faint hover:text-dx-ink">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                      <p className="text-sm font-medium text-dx-ink">{q.customer.name}</p>
                      {q.subject && <p className="text-xs text-dx-ink-faint line-clamp-1">{q.subject}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-semibold text-dx-ink">{formatCurrency(q.totalAmount)}</span>
                        <span className="text-xs text-dx-ink-faint">{formatDate(q.createdAt)}</span>
                      </div>
                      {ADVANCE_STATUS[col.key] && (
                        <button
                          onClick={() => advance(q.id, col.key)}
                          className="w-full mt-1 py-1.5 rounded-lg text-xs font-medium bg-dx-accent/10 text-dx-accent hover:bg-dx-accent/20 transition-colors"
                        >
                          Move to {ADVANCE_STATUS[col.key] === "SENT" ? "Sent" : "Accepted"} →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
