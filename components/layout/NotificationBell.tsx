"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  isBroadcast: boolean;
  createdAt: string;
  sender: { name: string } | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=15");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.notifications);
    setUnread(data.unreadCount);
  }, []);

  // Initial load + poll every 10s for new messages.
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPanel}
        className="relative w-9 h-9 rounded-lg bg-dx-surface border border-dx-line flex items-center justify-center text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-dx-accent text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto dx-card p-0 shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dx-line sticky top-0 bg-dx-surface">
            <span className="text-sm font-semibold text-dx-ink">Notifications</span>
            <Link href="/inbox" onClick={() => setOpen(false)} className="text-xs text-dx-accent hover:underline">
              View all
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-dx-ink-faint">No notifications yet</p>
          ) : (
            <ul className="divide-y divide-dx-line">
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3 hover:bg-dx-line/30 transition-colors">
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-dx-accent flex-shrink-0" />}
                    <div className={n.read ? "ml-4" : ""}>
                      <p className="text-sm font-medium text-dx-ink">{n.title}</p>
                      <p className="text-xs text-dx-ink-muted line-clamp-2 mt-0.5">{n.body}</p>
                      <p className="text-[11px] text-dx-ink-faint mt-1">
                        {n.isBroadcast ? "Announcement" : n.sender ? `From ${n.sender.name}` : "Message"} · {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
