"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { clearDeviceDrafts, countDeviceDrafts } from "@/lib/device-drafts";

export function SignOutButton() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function leave(clear: boolean) {
    setBusy(true); setError("");
    try {
      if (clear) {
        if (!session?.user.id) throw new Error("Account unavailable");
        // Do not reload this capture page before the sign-out request completes.
        await clearDeviceDrafts(session.user.id, false);
      }
      await signOut({ callbackUrl: "/login" });
    } catch {
      setOpen(true); setError(clear ? "Could not clear drafts and sign out. Retry, or keep drafts and sign out." : "Could not sign out. Check your connection and retry.");
    } finally { setBusy(false); }
  }
  return <>
    <button disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try {
        if (!session?.user.id) { await leave(false); return; }
        const counts = await countDeviceDrafts(session.user.id);
        if (counts.captures || counts.messages) setOpen(true);
        else await leave(false);
      } catch { setOpen(true); setError("Browser storage could not be checked. Drafts may remain on this device."); }
      finally { setBusy(false); }
    }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50 transition-all">
      <LogOut className="w-4 h-4 flex-shrink-0" />{busy ? "Signing out…" : "Sign out"}
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="signout-drafts-title" className="dx-card w-full max-w-md p-5 space-y-4 text-dx-ink">
        <h2 id="signout-drafts-title" className="font-semibold">Drafts on this device</h2>
        <p className="text-sm text-dx-ink-muted">Unfinished photos, recordings or group messages may remain in this browser. Keep them on your own device, or clear them before sharing it. Saved CRM records stay intact.</p>
        {error && <p role="alert" className="text-sm text-dx-danger">{error}</p>}
        <div className="flex flex-col gap-2">
          <button disabled={busy} onClick={() => leave(true)} className="dx-btn-gradient justify-center">Clear drafts and sign out</button>
          <button disabled={busy} onClick={() => leave(false)} className="dx-btn-ghost justify-center">Keep drafts and sign out</button>
          <button disabled={busy} onClick={() => setOpen(false)} className="dx-btn-ghost justify-center">Cancel</button>
        </div>
      </section>
    </div>, document.body)}
  </>;
}
