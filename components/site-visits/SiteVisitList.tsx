"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { visitStatuses } from "@/lib/site-visit-filters";
import { siteVisitDetailHref } from "@/lib/site-visit-navigation";
import { Camera, Plus, Search, MapPin, ImageIcon, Video, Mic, FolderOpen, List, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react";

interface Visit {
  id: string;
  title: string;
  location: string | null;
  status: "CAPTURED" | "QUOTED";
  contactName: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  company: { id: string; name: string; prefix: string } | null;
  attachments: { id: string; mimetype: string }[];
  _count: { attachments: number };
}

interface Props {
  visits: Visit[];
  total: number;
  search: string;
  status: string;
  view: "list" | "gallery";
  page: number;
  pageSize: number;
  showCompany: boolean;
}

function VisitThumbnail({ attachment }: { attachment?: Visit["attachments"][number] }) {
  const [failed, setFailed] = useState(false);
  const preview = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // The image can fail before React attaches its onError handler.
    if (preview.current?.complete && preview.current.naturalWidth === 0) setFailed(true);
  }, []);
  const isImage = attachment?.mimetype.startsWith("image/");
  const Icon = attachment?.mimetype.startsWith("audio/") ? Mic : attachment?.mimetype.startsWith("video/") ? Video : ImageIcon;
  return (
    <div className="w-full h-full bg-dx-accent/5 flex items-center justify-center text-dx-ink-faint" aria-hidden="true">
      {attachment && isImage && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={preview} src={`/api/uploads/${attachment.id}/file`} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : <Icon className="w-6 h-6" />}
    </div>
  );
}

export function SiteVisitList({ visits, total, search, status, view, page, pageSize, showCompany }: Props) {
  const gallery = view === "gallery";
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (next: { view?: "list" | "gallery"; page?: number } = {}) =>
    `/site-visits?${new URLSearchParams({ search, status, view: next.view || view, page: String(next.page || 1) })}`;
  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <form action="/site-visits" className="flex flex-1 min-w-48 gap-2 flex-wrap">
          <input type="hidden" name="view" value={view} />
          <label className="relative flex-1 min-w-48">
            <span className="sr-only">Search site visits</span>
            <Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dx-ink-faint" />
            <input name="search" defaultValue={search} key={search} placeholder="Search visits, projects, locations or customers…" className="w-full min-h-11 bg-dx-surface border border-dx-line rounded-xl pl-9 pr-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint" />
          </label>
          <label>
            <span className="sr-only">Visit status</span>
            <select name="status" defaultValue={status} key={status} className="min-h-11 bg-dx-surface border border-dx-line rounded-xl px-3 text-sm text-dx-ink">
              <option value="">All statuses</option>
              {Object.entries(visitStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="dx-btn-ghost min-h-11 text-sm">Search</button>
        </form>
        <Link href="/site-visits/new" className="dx-btn-gradient min-h-11 text-sm whitespace-nowrap"><Plus className="w-4 h-4" />New Visit</Link>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-dx-ink-muted">Newest first · {total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : "0"} visit{total !== 1 ? "s" : ""}</p>
        <nav aria-label="Site visit display" className="flex gap-2">
          <Link href={href({ view: "list", page })} aria-current={!gallery ? "page" : undefined} className={`${!gallery ? "dx-btn-gradient" : "dx-btn-ghost"} min-h-11 text-xs`}><List aria-hidden="true" className="w-4 h-4" />Compact list</Link>
          <Link href={href({ view: "gallery", page })} aria-current={gallery ? "page" : undefined} className={`${gallery ? "dx-btn-gradient" : "dx-btn-ghost"} min-h-11 text-xs`}><LayoutGrid aria-hidden="true" className="w-4 h-4" />Gallery</Link>
        </nav>
      </div>

      {visits.length === 0 ? (
        <div className="dx-card p-8 text-center">
          <Camera className="w-8 h-8 text-dx-accent mx-auto mb-3" />
          <h2 className="text-dx-ink font-medium">{search || status ? "No matching site visits" : "No site visits yet"}</h2>
          <p className="text-dx-ink-muted text-sm mt-2">{search || status ? "Try another search or status, or clear the filters." : "Capture photos and notes on-site, then turn them into a quotation."}</p>
          {search || status ? <Link href={`/site-visits?view=${view}`} className="dx-btn-ghost min-h-11 mt-4">Clear filters</Link> : <Link href="/site-visits/new" className="dx-btn-gradient min-h-11 mt-4"><Plus className="w-4 h-4" />New Visit</Link>}
        </div>
      ) : (
        <ul aria-label="Site visits" className={gallery ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" : "dx-card divide-y divide-dx-line"}>
          {visits.map((visit) => (
            <li key={visit.id} className={gallery ? "dx-card overflow-hidden" : "first:rounded-t-2xl last:rounded-b-2xl overflow-hidden"}>
              <Link href={siteVisitDetailHref(visit.id, href({ page }))} aria-label={`Open site visit ${visit.title}`} className={`group hover:bg-dx-accent/5 transition-colors ${gallery ? "block h-full" : "flex items-center gap-3 p-3 sm:px-4"}`}>
                <div className={gallery ? "h-36 overflow-hidden" : "w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0"}>
                  <VisitThumbnail key={visit.attachments[0]?.id || "empty"} attachment={visit.attachments[0]} />
                </div>
                <div className={`min-w-0 flex-1 ${gallery ? "p-3" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-sm text-dx-ink truncate">{visit.title}</h2>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${visit.status === "QUOTED" ? "bg-dx-success/10 text-dx-success" : "bg-dx-accent/10 text-dx-accent"}`}>{visitStatuses[visit.status]}</span>
                  </div>
                  <p className="text-xs text-dx-ink-muted truncate mt-1">
                    {visit.project ? <><FolderOpen aria-hidden="true" className="inline w-3 h-3 mr-1" />{visit.project.name} · </> : null}
                    {visit.customer?.name || visit.contactName || "No customer linked"}
                  </p>
                  {visit.location && <p className="text-xs text-dx-ink-muted truncate mt-1"><MapPin aria-hidden="true" className="inline w-3 h-3 mr-1" />{visit.location}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dx-ink-muted mt-2">
                    <time dateTime={visit.createdAt}>{formatDate(visit.createdAt)}</time>
                    {showCompany && visit.company && <span title={visit.company.name}>{visit.company.prefix}</span>}
                    <span className="inline-flex items-center gap-1"><ImageIcon aria-hidden="true" className="w-3 h-3" />{visit._count.attachments} file{visit._count.attachments !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {!gallery && <ChevronRight aria-hidden="true" className="hidden sm:block w-4 h-4 text-dx-ink-faint shrink-0" />}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > 0 && <nav aria-label="Site visit pages" className="flex items-center justify-between gap-3 text-xs text-dx-ink-muted">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={href({ page: page - 1 })} className="dx-btn-ghost min-h-11 text-xs"><ChevronLeft aria-hidden="true" className="w-4 h-4" />Previous</Link>}
          {page < pages && <Link href={href({ page: page + 1 })} className="dx-btn-ghost min-h-11 text-xs">Next<ChevronRight aria-hidden="true" className="w-4 h-4" /></Link>}
        </div>
      </nav>}
    </div>
  );
}
