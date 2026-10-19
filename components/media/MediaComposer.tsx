"use client";
/* Local blob previews cannot use the server image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { VoiceRecorder } from "./VoiceRecorder";
import { AudioPlayer } from "./AudioPlayer";
export interface StagedMedia {
  id: string;
  blob: Blob;
  name: string;
  mimetype: string;
  caption: string;
  uploaded?: boolean;
}
function Preview({ media }: { media: StagedMedia }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(media.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [media.blob]);
  if (!url) return null;
  if (media.mimetype.startsWith("audio/"))
    return (
      <AudioPlayer
        src={url}
        label={`Preview ${media.name}`}
      />
    );
  if (media.mimetype.startsWith("video/"))
    return (
      <video
        controls
        playsInline
        src={url}
        className="w-full h-44 object-contain rounded-lg bg-black/20"
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt={media.caption || media.name}
      className="w-full h-44 object-contain rounded-lg bg-black/20"
    />
  );
}
export function MediaComposer({
  media,
  onChange,
  onRecordingChange,
  disabled,
}: {
  media: StagedMedia[];
  onChange: (media: StagedMedia[]) => void;
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  function add(files: File[]) {
    const valid = files.filter((f) => f.size > 0 && f.size <= 50 * 1024 * 1024);
    setError(
      valid.length !== files.length
        ? "Some files were skipped. Each file must be non-empty and under 50 MB."
        : "",
    );
    onChange([
      ...media,
      ...valid.map((f) => ({
        id: crypto.randomUUID(),
        blob: f,
        name: f.name,
        mimetype: f.type,
        caption: "",
      })),
    ]);
  }
  const input = (
    ref: React.RefObject<HTMLInputElement | null>,
    capture: boolean,
  ) => (
    <input
      ref={ref}
      type="file"
      accept={capture ? "image/*,video/*" : "image/*,video/*,audio/*"}
      capture={capture ? "environment" : undefined}
      multiple={!capture}
      className="hidden"
      onChange={(e) => {
        add(Array.from(e.target.files || []));
        e.target.value = "";
      }}
    />
  );
  return (
    <section
      className="dx-card p-4 sm:p-5 space-y-4"
      aria-label="Photos, videos and voice notes"
    >
      <div>
        <h2 className="text-sm font-semibold text-dx-ink">
          Photos & voice notes
        </h2>
        <p className="text-xs text-dx-ink-muted mt-1">
          Add a description under each item. Up to 50 MB per file.
        </p>
      </div>
      {input(camera, true)}
      {input(library, false)}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => camera.current?.click()}
          className="dx-btn-gradient min-h-11"
        >
          <Camera className="w-4 h-4" />
          Take photo / video
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => library.current?.click()}
          className="dx-btn-ghost min-h-11"
        >
          <ImagePlus className="w-4 h-4" />
          Choose files
        </button>
        <VoiceRecorder
          onRecorded={(file) => add([file])}
          onRecordingChange={onRecordingChange}
          disabled={disabled}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {media.map((item, index) => (
          <div
            key={item.id}
            className="rounded-xl border border-dx-line p-3 space-y-3 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-dx-ink-muted truncate">
                {item.uploaded ? "Uploaded · " : ""}
                {item.name}
              </span>
              <button
                type="button"
                aria-label={`Remove item ${index + 1}`}
                disabled={disabled || item.uploaded}
                onClick={() => onChange(media.filter((m) => m.id !== item.id))}
                className="dx-btn-ghost min-h-11 min-w-11 justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Preview media={item} />
            <label className="block text-xs text-dx-ink-muted">
              Description for item {index + 1}
              <textarea
                value={item.caption}
                maxLength={1000}
                disabled={disabled || item.uploaded}
                onChange={(e) =>
                  onChange(
                    media.map((m) =>
                      m.id === item.id ? { ...m, caption: e.target.value } : m,
                    ),
                  )
                }
                placeholder="e.g. Kitchen wall — water damage near the window"
                className="mt-1 w-full bg-dx-surface border border-dx-line rounded-lg p-3 text-sm text-dx-ink"
                rows={2}
              />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
