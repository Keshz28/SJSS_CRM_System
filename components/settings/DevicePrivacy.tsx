"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { clearDeviceDrafts } from "@/lib/device-drafts";

export function DevicePrivacy() {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <section className="dx-card p-5 space-y-3 mt-6" aria-labelledby="device-privacy-title">
    <h2 id="device-privacy-title" className="font-semibold text-dx-ink">Privacy on this device</h2>
    <p className="text-sm text-dx-ink-muted">Unfinished photos, recordings and group messages can stay on this browser for offline work. Clear your drafts before sharing this device. Saved projects, uploaded files and sent messages stay in the CRM.</p>
    <button className="dx-btn-ghost" disabled={busy || !session?.user.id} onClick={async () => {
      if (!session?.user.id || !window.confirm("Clear your unfinished photos, recordings and group-message drafts from this browser? Other open CRM tabs will reload. Saved CRM records stay intact.")) return;
      setBusy(true); setMessage("");
      try { await clearDeviceDrafts(session.user.id); setMessage("Your drafts were cleared from this browser."); }
      catch { setMessage("Could not clear all drafts. Check browser storage permissions and retry before sharing this device."); }
      finally { setBusy(false); }
    }}>{busy ? "Clearing…" : "Clear my device drafts"}</button>
    {message && <p role="status" className="text-sm text-dx-ink-muted">{message}</p>}
  </section>;
}
