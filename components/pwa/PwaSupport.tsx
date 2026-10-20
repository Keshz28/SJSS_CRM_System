"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaSupport() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext)
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Draft storage works independently of installation. */
      });
  }, []);
  return null;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(true);
  const [guide, setGuide] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const sync = () =>
      setInstalled(
        display.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    sync();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    display.addEventListener("change", sync);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
      display.removeEventListener("change", sync);
    };
  }, []);
  async function install() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else setGuide(!guide);
  }
  if (installed) return null;
  return (
    <aside className="dx-card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-dx-ink">
            Keep SJSS on your home screen
          </p>
          <p className="text-xs text-dx-ink-muted mt-1">
            Open your projects like an app. Installation is on the device you’re using.
          </p>
        </div>
        <button onClick={install} className="dx-btn-ghost min-h-11 text-sm">
          <Download className="w-4 h-4" />
          Install app
        </button>
      </div>
      {guide && (
        <p role="status" className="text-sm text-dx-ink-muted mt-3">
          {ios
            ? "In Safari, open Share, then Add to Home Screen and confirm. Turn on Open as Web App if offered."
            : "Open your browser menu and choose Install app or Add to Home screen. To install on your phone, open the CRM on that phone first; installing here on a computer does not install it on your phone."}
        </p>
      )}
    </aside>
  );
}
