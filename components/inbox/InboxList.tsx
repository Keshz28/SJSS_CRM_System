"use client";

import { useState } from "react";
import {
  Megaphone,
  Mail,
  Trash2,
  Inbox as InboxIcon,
  Reply as ReplyIcon,
  Send,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  isBroadcast: boolean;
  createdAt: string;
  senderId: string | null;
  sender: { name: string } | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function InboxList({
  initial,
  currentUserRole,
  currentUserId,
}: {
  initial: NotificationItem[];
  currentUserRole: string;
  currentUserId: string;
}) {
  const [items, setItems] = useState(initial);

  async function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
  }

  // Staff can always reply (it routes to the admin). An admin only sees a reply
  // option on messages a user sent them — not on their own announcements.
  function canReply(n: NotificationItem): boolean {
    if (currentUserRole === "ADMIN") {
      return !!n.senderId && n.senderId !== currentUserId;
    }
    return true;
  }

  const replyHint =
    currentUserRole === "ADMIN" ? "Reply to this person" : "Reply to admin";

  if (items.length === 0) {
    return (
      <div className="dx-card p-12 flex flex-col items-center justify-center text-center max-w-2xl">
        <div className="w-14 h-14 rounded-2xl bg-dx-line/40 flex items-center justify-center mb-4">
          <InboxIcon className="w-6 h-6 text-dx-ink-faint" />
        </div>
        <p className="text-sm font-medium text-dx-ink">No messages yet</p>
        <p className="text-xs text-dx-ink-faint mt-1">Announcements and private messages will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {items.map((n) => (
        <MessageCard
          key={n.id}
          n={n}
          canReply={canReply(n)}
          replyHint={replyHint}
          onDelete={() => remove(n.id)}
        />
      ))}
    </div>
  );
}

function MessageCard({
  n,
  canReply,
  replyHint,
  onDelete,
}: {
  n: NotificationItem;
  canReply: boolean;
  replyHint: string;
  onDelete: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    const res = await fetch(`/api/notifications/${n.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const e = (data as { error?: unknown }).error;
      setError(typeof e === "string" ? e : "Could not send your reply.");
      return;
    }
    setSent(true);
    setReplying(false);
    setText("");
  }

  return (
    <div className="dx-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            n.isBroadcast ? "bg-dx-accent-2/15 text-dx-accent-2" : "bg-dx-accent/15 text-dx-accent"
          }`}
        >
          {n.isBroadcast ? <Megaphone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-dx-ink">{n.title}</h3>
            {n.isBroadcast && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-dx-accent-2/15 text-dx-accent-2">
                Announcement
              </span>
            )}
          </div>
          <p className="text-sm text-dx-ink-muted mt-1 whitespace-pre-wrap break-words">{n.body}</p>
          <p className="text-[11px] text-dx-ink-faint mt-2">
            {n.sender ? `From ${n.sender.name}` : "System"} · {formatDate(n.createdAt)}
          </p>

          {canReply && !replying && (
            <button
              onClick={() => {
                setReplying(true);
                setSent(false);
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-dx-accent hover:underline"
            >
              <ReplyIcon className="w-3.5 h-3.5" /> {replyHint}
            </button>
          )}
          {sent && !replying && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#14CA74] font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> Reply sent
            </p>
          )}

          {replying && (
            <form onSubmit={sendReply} className="mt-3 space-y-2">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your reply…"
                className="w-full bg-dx-surface border border-dx-line rounded-xl px-3 py-2.5 text-sm text-dx-ink placeholder-dx-ink-faint focus:outline-none focus:border-dx-accent transition-colors min-h-[80px] resize-y"
                required
              />
              {error && (
                <p className="flex items-center gap-2 text-xs text-dx-danger bg-dx-danger/10 border border-dx-danger/30 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={sending} className="dx-btn-gradient">
                  <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send Reply"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplying(false);
                    setError("");
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-dx-line text-dx-ink-muted hover:text-dx-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        <button
          onClick={onDelete}
          title="Delete"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-dx-line text-dx-ink-faint hover:text-dx-danger hover:border-dx-danger/40 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
