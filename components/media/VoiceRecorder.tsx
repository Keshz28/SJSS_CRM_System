"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

export function VoiceRecorder({
  onRecorded,
  onRecordingChange,
  disabled,
}: {
  onRecorded: (file: File) => void;
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const attempt = useRef(0);
  const callback = useRef(onRecorded);
  callback.current = onRecorded;
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    onRecordingChange?.(recording || starting);
  }, [recording, starting, onRecordingChange]);
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 180 && recorder.current?.state === "recording")
        recorder.current.stop();
    }, 500);
    // Finalize before the browser suspends the page where possible.
    const hidden = () => {
      if (document.hidden && recorder.current?.state === "recording")
        recorder.current.stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [recording]);
  async function start() {
    const currentAttempt = ++attempt.current;
    setError("");
    setStarting(true);
    try {
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder
      )
        throw new Error(
          "Voice recording needs a supported browser and an HTTPS connection.",
        );
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current || currentAttempt !== attempt.current) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = acquired;
      const player = document.createElement("audio");
      const mimeType = [
        // A bare audio/mp4 can select Opus-in-MP4, which some embedded
        // browsers can record but cannot play. Prefer an explicit codec and
        // check both recording and playback support in this browser.
        "audio/mp4;codecs=mp4a.40.2",
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ].find(
        (type) =>
          MediaRecorder.isTypeSupported(type) && Boolean(player.canPlayType(type)),
      );
      if (!mimeType)
        throw new Error(
          "This browser cannot record a playable voice note. Open this page in Chrome or Safari to record.",
        );
      const rec = new MediaRecorder(stream.current, { mimeType });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        const type =
          rec.mimeType.split(";")[0] ||
          chunks[0]?.type.split(";")[0] ||
          "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size && mounted.current)
          callback.current(
            new File(
              [blob],
              `Voice note ${new Date().toISOString().replaceAll(":", "-")}.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`,
              { type },
            ),
          );
        stream.current?.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        setRecording(false);
      };
      rec.onerror = () => {
        setError(
          "Recording was interrupted. Check the saved audio before uploading.",
        );
        if (rec.state !== "inactive") rec.stop();
      };
      recorder.current = rec;
      setSeconds(0);
      setRecording(true);
      rec.start(1000);
    } catch (err) {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (mounted.current && currentAttempt === attempt.current)
        setError(
          (err as Error).name === "NotAllowedError"
            ? "Microphone access was denied. Allow it in your browser settings to record."
            : (err as Error).message,
        );
    } finally {
      if (mounted.current && currentAttempt === attempt.current)
        setStarting(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={disabled || starting}
        onClick={() => (recording ? recorder.current?.stop() : start())}
        className={`dx-btn-ghost min-h-11 ${recording ? "text-red-400" : ""}`}
        aria-label={recording ? "Stop voice recording" : "Record voice note"}
      >
        {recording ? (
          <Square className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
        {recording
          ? `Stop recording · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : starting
            ? "Opening microphone…"
            : "Record voice note"}
      </button>
      {starting && (
        <div className="text-xs text-dx-ink-muted mt-2">
          Allow microphone access in your browser.{" "}
          <button
            type="button"
            className="underline min-h-11 px-2"
            onClick={() => {
              attempt.current++;
              setStarting(false);
            }}
          >
            Cancel microphone request
          </button>
        </div>
      )}
      {recording && (
        <p className="text-xs text-dx-ink-muted mt-2" role="status">
          Keep this screen open. Up to 3 minutes per note.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
