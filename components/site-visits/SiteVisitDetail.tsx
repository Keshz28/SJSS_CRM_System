"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Camera, FileText, FolderOpen, Trash2 } from "lucide-react";
import { MediaGallery, type MediaItem } from "@/components/media/MediaGallery";
interface Visit {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  createdAt: string;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  project?: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  quotation: { id: string; quotationNumber: string } | null;
  createdBy: { id: string; name: string };
  attachments: MediaItem[];
}
export function SiteVisitDetail({ visit, returnTo = "/site-visits" }: { visit: Visit; returnTo?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const canEdit = session?.user.role === "ADMIN" || session?.user.id === visit.createdBy.id;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function action(remove = false) {
    if (
      remove &&
      !confirm(
        "Delete this update and its media? Copies already attached to quotations will remain.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/site-visits/${visit.id}${remove ? "" : "/convert"}`,
        { method: remove ? "DELETE" : "POST" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not complete the action.");
      router.push(
        remove ? returnTo : `/quotations/${data.quotationId}/edit`,
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex gap-2 flex-wrap items-center">
        <Link
          href={returnTo}
          className="dx-btn-ghost min-h-11"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to site visits
        </Link>
        {canEdit && <Link
          href={`/site-visits/new?${new URLSearchParams({ visitId: visit.id, returnTo })}`}
          className="dx-btn-gradient min-h-11"
        >
          <Camera className="w-4 h-4" />
          Add photos or voice notes
        </Link>}
        {visit.quotation ? (
          <Link
            href={`/quotations/${visit.quotation.id}`}
            className="dx-btn-ghost min-h-11"
          >
            <FileText className="w-4 h-4" />
            {visit.quotation.quotationNumber}
          </Link>
        ) : canEdit ? (
          <button
            disabled={busy}
            onClick={() => action()}
            className="dx-btn-ghost min-h-11"
          >
            Create quotation
          </button>
        ) : null}
        {(session?.user.role === "ADMIN" ||
          session?.user.id === visit.createdBy.id) && (
          <button
            disabled={busy}
            onClick={() => action(true)}
            className="dx-btn-ghost min-h-11 min-w-11 justify-center text-red-400"
            aria-label="Delete this update"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <section className="dx-card p-4 sm:p-5 space-y-3">
        <h2 className="text-lg font-semibold text-dx-ink">{visit.title}</h2>
        <p className="text-sm text-dx-ink-muted">
          {visit.company?.name} ·{" "}
          {visit.customer?.name || visit.contactName || "New prospect"}
        </p>
        {visit.project && <Link href={`/projects/${visit.project.id}`} className="inline-flex items-center gap-2 text-sm text-dx-accent min-h-11">
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span className="break-words">Open project: {visit.project.name}</span>
        </Link>}
        {visit.location && (
          <p className="text-sm text-dx-ink-muted">{visit.location}</p>
        )}
        {visit.notes && (
          <p className="text-sm text-dx-ink whitespace-pre-wrap">
            {visit.notes}
          </p>
        )}
        <p className="text-xs text-dx-ink-faint">
          {visit.createdBy.name} · {new Date(visit.createdAt).toLocaleString()}
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-dx-ink mb-3">
          Photos, videos & voice notes
        </h2>
        <MediaGallery
          media={visit.attachments}
          fallbackOwnerId={visit.createdBy.id}
        />
      </section>
    </div>
  );
}
