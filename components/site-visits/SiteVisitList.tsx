"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { Camera, Plus, Search, MapPin, ImageIcon, Play } from "lucide-react";

interface Visit {
  id: string;
  title: string;
  location: string | null;
  status: "CAPTURED" | "QUOTED";
  contactName: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  company: { id: string; name: string; prefix: string } | null;
  attachments: { id: string; filepath: string; mimetype: string }[];
  _count: { attachments: number };
}

interface Props {
  visits: Visit[];
  total: number;
  search: string;
  /** Whether to show the company prefix on each card (combined view only). */
  showCompany: boolean;
}

function statusBadge(status: string) {
  return status === "QUOTED"
    ? "bg-[#14CA74]/15 text-[#14CA74]"
    : "bg-[#00C2FF]/15 text-[#00C2FF]";
}

export function SiteVisitList({ visits, total, search, showCompany }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(search);

  function applyFilters(next: { search?: string }) {
    const params = new URLSearchParams();
    const s = next.search ?? query;
    if (s) params.set("search", s);
    router.push(`/site-visits${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <form
          onSubmit={(e) => { e.preventDefault(); applyFilters({ search: query }); }}
          className="relative flex-1"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dx-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search visits by title, location, or customer…"
            className="w-full bg-dx-surface border border-dx-line rounded-xl pl-9 pr-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent"
          />
        </form>
        <Link href="/site-visits/new" className="dx-btn-gradient whitespace-nowrap">
          <Plus className="w-4 h-4" />
          New Visit
        </Link>
      </div>

      {/* Grid */}
      {visits.length === 0 ? (
        <div className="dx-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-dx-accent/15 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-7 h-7 text-dx-accent" />
          </div>
          <p className="text-dx-ink font-medium mb-1">No site visits yet</p>
          <p className="text-dx-ink-faint text-sm mb-5">
            Capture photos and notes on-site, then turn them into a quotation.
          </p>
          <Link href="/site-visits/new" className="dx-btn-gradient inline-flex">
            <Plus className="w-4 h-4" />
            New Visit
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visits.map((visit) => {
            const thumb = visit.attachments[0];
            return (
              <Link
                key={visit.id}
                href={`/site-visits/${visit.id}`}
                className="dx-card overflow-hidden hover:border-dx-accent/40 transition-colors group"
              >
                <div className="aspect-video bg-dx-surface relative overflow-hidden">
                  {thumb ? (
                    thumb.mimetype?.startsWith("video/") ? (
                      <>
                        <video src={`/${thumb.filepath}`} muted playsInline className="w-full h-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-9 h-9 rounded-full bg-black/55 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </span>
                        </span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/${thumb.filepath}`}
                        alt={visit.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dx-ink-faint">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge(visit.status)}`}>
                    {visit.status === "QUOTED" ? "Quoted" : "Captured"}
                  </span>
                  {visit._count.attachments > 0 && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/60 text-white flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {visit._count.attachments}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-dx-ink truncate">{visit.title}</p>
                  <p className="text-sm text-dx-ink-muted truncate">
                    {visit.customer?.name ?? visit.contactName ?? "—"}
                  </p>
                  {visit.location && (
                    <p className="text-xs text-dx-ink-faint truncate flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {visit.location}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3 text-xs text-dx-ink-faint">
                    <span>{showCompany ? visit.company?.prefix ?? "" : ""}</span>
                    <span>{formatDate(visit.createdAt)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <p className="text-xs text-dx-ink-faint">{total} visit{total !== 1 ? "s" : ""} total</p>
      )}
    </div>
  );
}
