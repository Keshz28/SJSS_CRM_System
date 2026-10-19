"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { draftRevision, onDraftsCleared } from "@/lib/draft-revision";

interface Message { id: string; authorId: string | null; authorName: string; body: string; isAnnouncement: boolean; createdAt: string; clientRequestId: string }
interface Draft { body: string; clientRequestId: string; isAnnouncement: boolean }
const stamp = (date: string) => new Intl.DateTimeFormat("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
function merge(previous: Message[], incoming: Message[]) {
  const ids = new Set(previous.map((m) => m.id));
  const added = incoming.filter((m) => !ids.has(m.id));
  return added.length ? [...previous, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) : previous;
}
export function WorkGroupChat({ id, currentUserId, isAdmin }: { id: string; currentUserId: string; isAdmin: boolean }) {
  const [view, setView] = useState("all");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true), [older, setOlder] = useState(false), [hasOlder, setHasOlder] = useState(false);
  const [loadError, setLoadError] = useState(""), [sendError, setSendError] = useState(""), [blocked, setBlocked] = useState(false);
  const [sending, setSending] = useState(false), [draftLoaded, setDraftLoaded] = useState(false), [storageError, setStorageError] = useState(false);
  const [draft, setDraft] = useState<Draft>({ body: "", clientRequestId: "", isAnnouncement: false });
  const [hasNew, setHasNew] = useState(false);
  const scroll = useRef<HTMLDivElement>(null), nearBottom = useRef(true), prependHeight = useRef<number | null>(null);
  const version = useRef(0), pollNow = useRef<() => void>(() => {}), olderRequest = useRef<AbortController | null>(null);
  const storageKey = `sjss-group-draft:${currentUserId}:${id}`;
  const storageRevision = useRef<string | undefined>(undefined);
  useEffect(() => onDraftsCleared(currentUserId, () => window.location.reload()), [currentUserId]);
  useEffect(() => {
    try {
      storageRevision.current = draftRevision(currentUserId);
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      setDraft(saved && (saved.revision || "0") === storageRevision.current && typeof saved.body === "string" && saved.body.length <= 4000 && typeof saved.isAnnouncement === "boolean" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.clientRequestId) ? { body: saved.body, clientRequestId: saved.clientRequestId, isAnnouncement: isAdmin && saved.isAnnouncement } : { body: "", clientRequestId: crypto.randomUUID(), isAnnouncement: false });
    } catch { setDraft({ body: "", clientRequestId: crypto.randomUUID(), isAnnouncement: false }); setStorageError(true); }
    setDraftLoaded(true);
  }, [storageKey, isAdmin, currentUserId]);
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      if (storageRevision.current !== draftRevision(currentUserId)) return;
      if (draft.body) localStorage.setItem(storageKey, JSON.stringify({ ...draft, revision: storageRevision.current })); else localStorage.removeItem(storageKey);
    }
    catch { setStorageError(true); }
  }, [draft, draftLoaded, storageKey, currentUserId]);
  useEffect(() => {
    version.current++;
    let stopped = false, fetching = false, cursor = "";
    let controller: AbortController | null = null;
    setMessages([]); setLoading(true); setOlder(false); setHasOlder(false); setLoadError(""); setBlocked(false); setHasNew(false);
    nearBottom.current = true; prependHeight.current = null;
    async function load() {
      if (stopped || fetching || document.visibilityState === "hidden") return;
      fetching = true;
      controller = new AbortController();
      try {
        // Advance the polling cursor only from fetched messages, never from a send.
        // This keeps other members' simultaneous messages from being skipped.
        const response = await fetch(`/api/work-groups/${id}/messages?${new URLSearchParams({ view, ...(cursor && { after: cursor }) })}`, { signal: controller.signal, cache: "no-store" });
        const data = await response.json().catch(() => ({ error: "Could not read messages. Please try again." }));
        if (stopped) return;
        if (!response.ok) {
          if (response.status === 401 || response.status === 404) setBlocked(true);
          throw new Error(data.error || "Could not load messages.");
        }
        if (!Array.isArray(data.messages)) throw new Error("Could not read messages. Please try again.");
        if (!cursor) setHasOlder(data.hasMore);
        if (data.messages.length) {
          setMessages((prev) => merge(prev, data.messages));
          cursor = data.messages[data.messages.length - 1].id;
        }
        setLoadError(""); setBlocked(false);
      } catch (err) {
        if (!stopped) setLoadError((err as Error).message === "Failed to fetch" ? "Connection interrupted. Your typed message stays here; retry when connected." : (err as Error).message);
      } finally { if (!stopped) { setLoading(false); fetching = false; } }
    }
    pollNow.current = () => { void load(); };
    void load();
    const timer = setInterval(() => { void load(); }, 3000);
    const refresh = () => { void load(); };
    window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true; controller?.abort(); olderRequest.current?.abort(); clearInterval(timer);
      window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh);
      pollNow.current = () => {};
    };
  }, [id, view]);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (prependHeight.current !== null) { element.scrollTop += element.scrollHeight - prependHeight.current; prependHeight.current = null; }
    else if (nearBottom.current) element.scrollTop = element.scrollHeight;
    else setHasNew(true);
  }, [messages]);
  async function loadOlder() {
    if (!messages.length || older) return;
    setOlder(true); const current = version.current;
    const controller = new AbortController(); olderRequest.current = controller;
    try {
      const response = await fetch(`/api/work-groups/${id}/messages?${new URLSearchParams({ view, before: messages[0].id })}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json().catch(() => ({ error: "Could not read older messages. Please try again." }));
      if (current !== version.current) return;
      if (!response.ok) throw new Error(data.error || "Could not load older messages.");
      if (!Array.isArray(data.messages)) throw new Error("Could not read older messages. Please try again.");
      prependHeight.current = scroll.current?.scrollHeight || 0;
      setMessages((prev) => merge(prev, data.messages)); setHasOlder(data.hasMore); setLoadError("");
    } catch (err) { if (current === version.current && !controller.signal.aborted) setLoadError((err as Error).message); }
    finally { if (current === version.current) setOlder(false); }
  }
  function edit(body: string, isAnnouncement = draft.isAnnouncement) { setDraft({ body, isAnnouncement, clientRequestId: crypto.randomUUID() }); setSendError(""); }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!draft.body.trim() || sending || !draftLoaded) return;
    setSending(true); setSendError("");
    try {
      const response = await fetch(`/api/work-groups/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, isAnnouncement: isAdmin && (view === "announcements" || draft.isAnnouncement) }) });
      const data = await response.json().catch(() => ({ error: "Could not confirm the send. Please retry." }));
      if (!response.ok) throw new Error(data.error || "Could not send the message.");
      if (typeof data.id !== "string" || typeof data.body !== "string") throw new Error("Could not confirm the send. Please retry.");
      nearBottom.current = true; setMessages((prev) => merge(prev, [data]));
      setDraft({ body: "", clientRequestId: crypto.randomUUID(), isAnnouncement: false });
      pollNow.current();
    } catch (err) { setSendError(`${(err as Error).message} Your message is kept here; retry to send it once.`); }
    finally { setSending(false); }
  }
  return <section aria-label="Group conversation" className="space-y-3 max-w-4xl min-w-0">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Group message views">
      <button disabled={sending} onClick={() => setView("all")} aria-pressed={view === "all"} className={`${view === "all" ? "dx-btn-gradient" : "dx-btn-ghost"} min-h-11 text-sm`}>Conversation</button>
      <button disabled={sending} onClick={() => setView("announcements")} aria-pressed={view === "announcements"} className={`${view === "announcements" ? "dx-btn-gradient" : "dx-btn-ghost"} min-h-11 text-sm`}><Megaphone className="w-4 h-4" />Announcements</button>
    </div>
    <p className="text-xs text-dx-ink-muted">Messages update every few seconds while the group is open. Official announcements are posted by administrators.</p>
    {loadError && <p role="alert" className="text-sm text-dx-danger">{loadError} <button onClick={() => pollNow.current()} className="underline min-h-11">Retry refresh</button></p>}
    <div ref={scroll} role="log" aria-label="Group messages" aria-live="polite" onScroll={() => {
      const el = scroll.current; if (!el) return;
      nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (nearBottom.current) setHasNew(false);
    }} className="dx-card p-3 sm:p-4 h-[min(55vh,36rem)] min-h-64 overflow-y-auto space-y-3">
      {hasOlder && <button disabled={older} onClick={loadOlder} className="dx-btn-ghost min-h-11 text-xs mx-auto flex">{older ? "Loading…" : "Load older messages"}</button>}
      {loading ? <p role="status" className="text-sm text-dx-ink-muted">Loading messages…</p> : !messages.length && <p className="text-sm text-dx-ink-muted">{view === "announcements" ? "No official announcements yet." : "Start the conversation with your team."}</p>}
      {messages.map((message) => <article key={message.id} aria-label={`Message from ${message.authorName}`} className={`rounded-xl p-3 max-w-[95%] sm:max-w-[85%] ${message.isAnnouncement ? "border border-dx-accent/40 bg-dx-accent/5" : message.authorId === currentUserId ? "ml-auto bg-dx-accent/10" : "bg-dx-surface-2"}`}>
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-dx-ink-muted"><span className="font-semibold text-dx-ink">{message.authorName}</span>{message.isAnnouncement && <span className="font-semibold text-dx-accent">Official announcement</span>}</div>
        <p className="text-sm text-dx-ink whitespace-pre-wrap break-words [overflow-wrap:anywhere] mt-1">{message.body}</p>
        <time dateTime={message.createdAt} className="block text-[11px] text-dx-ink-muted mt-2">{stamp(message.createdAt)}</time>
      </article>)}
    </div>
    {hasNew && <button onClick={() => { nearBottom.current = true; if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; setHasNew(false); }} className="dx-btn-ghost min-h-11 text-xs">Go to latest messages</button>}
    {(view === "all" || isAdmin) && <form onSubmit={send} className="dx-card p-3 space-y-3">
      <label className="block"><span className="sr-only">Group message</span><textarea disabled={sending || blocked || !draftLoaded} value={draft.body} onChange={(e) => edit(e.target.value)} maxLength={4000} rows={3} placeholder={view === "announcements" ? "Write an official announcement…" : "Write to your team…"} className="w-full rounded-xl bg-dx-surface border border-dx-line p-3 text-sm text-dx-ink" /></label>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        {isAdmin && view === "all" ? <label className="flex items-center gap-2 text-xs text-dx-ink-muted min-h-11"><input type="checkbox" disabled={sending || blocked} checked={draft.isAnnouncement} onChange={(e) => edit(draft.body, e.target.checked)} />Official announcement</label> : <span className="text-xs text-dx-ink-muted">{view === "announcements" ? "Official announcement" : "Team message"}</span>}
        <button disabled={sending || blocked || loading || !draftLoaded || !draft.body.trim()} className="dx-btn-gradient min-h-11 text-sm"><Send className="w-4 h-4" />{sending ? "Sending…" : "Send to group"}</button>
      </div>
      {sendError && <p role="alert" className="text-sm text-dx-danger">{sendError}</p>}
      {storageError && <p className="text-xs text-dx-ink-muted">Device draft storage is unavailable. Keep this page open until your message sends.</p>}
    </form>}
  </section>;
}
