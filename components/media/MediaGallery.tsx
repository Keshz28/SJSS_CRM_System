"use client";
/* Authenticated media must be requested by the browser with its session cookie. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, Pencil, Trash2 } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";
export interface MediaItem {
  id: string;
  filename: string;
  mimetype: string;
  caption?: string | null;
  uploadedAt?: string;
  uploadedById?: string | null;
  uploadedBy?: { name: string } | null;
}
export function MediaGallery({
  media,
  fallbackOwnerId,
}: {
  media: MediaItem[];
  fallbackOwnerId?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [items, setItems] = useState(media);
  const [editing, setEditing] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function change(item: MediaItem, remove = false) {
    if (remove && !confirm("Remove this media item? This cannot be undone."))
      return;
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch(`/api/uploads/${item.id}`, {
        method: remove ? "DELETE" : "PATCH",
        ...(!remove && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption }),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not update the media.");
      setItems((current) =>
        remove
          ? current.filter((m) => m.id !== item.id)
          : current.map((m) =>
              m.id === item.id ? { ...m, caption: data.caption } : m,
            ),
      );
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!items.length)
    return (
      <p className="text-sm text-dx-ink-muted py-6">
        No media yet. Capture an update to add photos or a voice note.
      </p>
    );
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => {
          const url = `/api/uploads/${item.id}/file`;
          const canEdit =
            session?.user.role === "ADMIN" ||
            session?.user.id === (item.uploadedById || fallbackOwnerId);
          return (
            <article key={item.id} className="dx-card overflow-hidden min-w-0">
              <div className="bg-black/15 p-2 flex items-center justify-center min-h-24">
                {item.mimetype.startsWith("image/") ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                    aria-label={`Open ${item.caption || item.filename}`}
                  >
                    <img
                      src={url}
                      alt={item.caption || item.filename}
                      className="w-full h-52 object-contain rounded-lg"
                      loading="lazy"
                    />
                  </a>
                ) : item.mimetype.startsWith("video/") ? (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={url}
                    className="w-full h-52 object-contain rounded-lg"
                  />
                ) : item.mimetype.startsWith("audio/") ? (
                  <AudioPlayer
                    src={url}
                    label={item.caption || item.filename}
                  />
                ) : (
                  <a
                    href={url}
                    className="text-dx-accent text-sm break-all p-4"
                  >
                    {item.filename}
                  </a>
                )}
              </div>
              <div className="p-3 space-y-2">
                {editing === item.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs text-dx-ink-muted">
                      Media description
                      <textarea
                        className="mt-1 w-full bg-dx-surface border border-dx-line rounded-lg p-3 text-sm text-dx-ink"
                        maxLength={1000}
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        rows={3}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => change(item)}
                        disabled={busy === item.id}
                        className="dx-btn-gradient min-h-11"
                      >
                        Save caption
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="dx-btn-ghost min-h-11"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-dx-ink whitespace-pre-wrap break-words">
                    {item.caption || (
                      <span className="text-dx-ink-faint">No description</span>
                    )}
                  </p>
                )}
                <p className="text-xs text-dx-ink-faint truncate">
                  {item.uploadedBy?.name || "Uploaded"}
                  {item.uploadedAt
                    ? ` · ${new Date(item.uploadedAt).toLocaleDateString()}`
                    : ""}
                </p>
                <div className="flex gap-1 flex-wrap">
                  <a
                    href={`${url}?download=1`}
                    className="dx-btn-ghost min-h-11 text-xs"
                    aria-label={`Download ${item.filename}`}
                  >
                    <Download className="w-4 h-4" />
                    Save copy
                  </a>
                  {canEdit && (
                    <>
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => {
                          setEditing(item.id);
                          setCaption(item.caption || "");
                        }}
                        className="dx-btn-ghost min-h-11 min-w-11 justify-center"
                        aria-label={`Edit caption for ${item.filename}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => change(item, true)}
                        className="dx-btn-ghost min-h-11 min-w-11 justify-center text-red-400"
                        aria-label={`Delete ${item.filename}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
