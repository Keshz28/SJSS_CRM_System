"use client";

import { useState } from "react";
import { Send, Megaphone, User as UserIcon, CheckCircle, AlertCircle } from "lucide-react";

interface Recipient {
  id: string;
  name: string;
  email: string;
}

const fieldCls =
  "w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent transition-colors";
const labelCls = "block text-sm font-medium text-dx-ink-muted mb-1.5";

function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error: unknown }).error;
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      const fe = e as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      const first = fe.formErrors?.[0] ?? Object.values(fe.fieldErrors ?? {})[0]?.[0];
      if (first) return first;
    }
  }
  return fallback;
}

export function MessageComposer({ recipients }: { recipients: Recipient[] }) {
  const [mode, setMode] = useState<"all" | "private">("all");
  const [target, setTarget] = useState(recipients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        target: mode === "all" ? "all" : target,
      }),
    });

    setSending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(extractError(data, "Could not send the message."));
      return;
    }
    setSuccess(
      data.broadcast
        ? `Broadcast sent to ${data.sent} user${data.sent === 1 ? "" : "s"}.`
        : "Private message sent."
    );
    setTitle("");
    setBody("");
  }

  return (
    <form onSubmit={handleSend} className="dx-card p-5 space-y-5 max-w-2xl">
      <div className="flex items-center gap-3 border-b border-dx-line pb-4">
        <div className="w-10 h-10 rounded-xl bg-dx-accent/10 flex items-center justify-center">
          <Send className="w-5 h-5 text-dx-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-dx-ink">Compose a notification</h3>
          <p className="text-xs text-dx-ink-faint">It appears in the recipient&apos;s notification bell and inbox</p>
        </div>
      </div>

      {/* Recipient mode toggle */}
      <div>
        <label className={labelCls}>Send to</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              mode === "all"
                ? "border-dx-accent bg-dx-accent/10 text-dx-ink"
                : "border-dx-line text-dx-ink-muted hover:text-dx-ink"
            }`}
          >
            <Megaphone className="w-4 h-4" /> Everyone (broadcast)
          </button>
          <button
            type="button"
            onClick={() => setMode("private")}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              mode === "private"
                ? "border-dx-accent bg-dx-accent/10 text-dx-ink"
                : "border-dx-line text-dx-ink-muted hover:text-dx-ink"
            }`}
          >
            <UserIcon className="w-4 h-4" /> One person (private)
          </button>
        </div>
      </div>

      {mode === "private" && (
        <div>
          <label className={labelCls}>Recipient</label>
          {recipients.length === 0 ? (
            <p className="text-xs text-dx-ink-faint">No other active users to message yet.</p>
          ) : (
            <select className={fieldCls} value={target} onChange={(e) => setTarget(e.target.value)}>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.email}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <label className={labelCls}>Title</label>
        <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Office closed this Friday" required />
      </div>

      <div>
        <label className={labelCls}>Message</label>
        <textarea className={`${fieldCls} min-h-[120px] resize-y`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" required />
      </div>

      {error && (
        <p className="flex items-center gap-2 text-xs text-dx-danger bg-dx-danger/10 border border-dx-danger/30 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 text-xs text-[#14CA74] bg-[#14CA74]/10 border border-[#14CA74]/30 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
        </p>
      )}

      <button
        type="submit"
        disabled={sending || (mode === "private" && recipients.length === 0)}
        className="dx-btn-gradient disabled:opacity-50"
      >
        <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
