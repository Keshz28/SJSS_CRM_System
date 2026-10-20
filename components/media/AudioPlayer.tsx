"use client";
import { useEffect, useRef, useState } from "react";

export function AudioPlayer({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // The server-rendered audio can fail before React attaches event handlers.
    setFailed(Boolean(audio.current?.error));
  }, [src]);
  return (
    <div className="w-full min-w-0 space-y-2">
      <audio
        ref={audio}
        controls
        preload="metadata"
        src={src}
        className="w-full"
        aria-label={label}
        onError={() => setFailed(true)}
        onLoadedMetadata={() => setFailed(false)}
      />
      {failed && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-400">
            This recording couldn’t load or play here. Try again, or open this
            page in Chrome or Safari. VS Code’s preview may not support the audio
            format.
          </p>
          <button
            type="button"
            className="dx-btn-ghost min-h-11 text-xs"
            onClick={() => {
              setFailed(false);
              audio.current?.load();
            }}
          >
            Retry audio
          </button>
        </div>
      )}
    </div>
  );
}
