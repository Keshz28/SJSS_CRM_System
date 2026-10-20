"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, RotateCcw, Star, Trash2 } from "lucide-react";

export function ProjectActions({ id, name, isPinned = false, isStarred = false, canDelete, deleted = false, inWorkspace = false }: {
  id: string; name: string; isPinned?: boolean; isStarred?: boolean;
  canDelete: boolean; deleted?: boolean; inWorkspace?: boolean;
}) {
  const router = useRouter();
  const [flags, setFlags] = useState({ isPinned, isStarred });
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => setFlags({ isPinned, isStarred }), [isPinned, isStarred]);
  async function change(action: "pin" | "star" | "delete" | "restore") {
    if (action === "delete" && !confirm(`Move “${name}” to Recently deleted? Its site updates and media will be kept for restoration. Quotations remain available.`)) return;
    setBusy(true); setError("");
    try {
      const preference = action === "pin" || action === "star";
      const url = `/api/projects/${id}${preference ? "/preferences" : action === "restore" ? "/restore" : ""}`;
      const response = await fetch(url, {
        method: preference ? "PATCH" : action === "restore" ? "POST" : "DELETE",
        ...(preference && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action === "pin" ? { isPinned: !flags.isPinned } : { isStarred: !flags.isStarred }),
        }),
      });
      const data = await response.json().catch(() => ({ error: "Could not update the project. Please try again." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update the project. Please try again.");
      if (!preference) {
        // Load a fresh list and count together after a confirmed delete/restore.
        // Keep its existing URL filters and avoid overlapping router refreshes.
        window.location.assign(inWorkspace ? "/projects" : window.location.href);
        return;
      }
      setFlags(data);
      startTransition(() => router.refresh());
      setBusy(false);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap" role="group" aria-label={`Actions for ${name}`}>
        {!deleted && <>
          <button type="button" disabled={busy || pending} aria-pressed={flags.isPinned} aria-label={`${flags.isPinned ? "Unpin" : "Pin"} ${name}`} title="Keep this project at the top of your list" onClick={() => change("pin")} className={`dx-btn-ghost text-xs ${flags.isPinned ? "text-dx-accent border-dx-accent bg-dx-accent/10" : ""}`}>
            <Pin className="w-4 h-4" fill={flags.isPinned ? "currentColor" : "none"} />{flags.isPinned ? "Pinned" : "Pin"}
          </button>
          <button type="button" disabled={busy || pending} aria-pressed={flags.isStarred} aria-label={`${flags.isStarred ? "Unstar" : "Star"} ${name}`} title="Mark this project as important for you" onClick={() => change("star")} className={`dx-btn-ghost text-xs ${flags.isStarred ? "text-dx-warning border-dx-warning bg-dx-warning/10" : ""}`}>
            <Star className="w-4 h-4" fill={flags.isStarred ? "currentColor" : "none"} />{flags.isStarred ? "Starred" : "Star"}
          </button>
        </>}
        {canDelete && <button type="button" disabled={busy || pending} aria-label={`${deleted ? "Restore" : "Delete"} ${name}`} onClick={() => change(deleted ? "restore" : "delete")} className={`dx-btn-ghost text-xs ${deleted ? "text-dx-accent" : "text-dx-danger"}`}>
          {deleted ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}{deleted ? "Restore" : "Delete"}
        </button>}
      </div>
      {error && <p role="alert" className="text-sm text-dx-danger">{error}</p>}
    </div>
  );
}
