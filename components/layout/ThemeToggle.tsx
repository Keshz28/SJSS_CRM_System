"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("sjss-theme", next ? "light" : "dark");
    } catch {}
  }

  return (
    <button
      onClick={toggle}
      title={light ? "Switch to dark" : "Switch to light"}
      aria-label="Toggle theme"
      className="w-9 h-9 rounded-lg bg-dx-surface border border-dx-line flex items-center justify-center text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 transition-colors"
    >
      {/* Render a neutral icon until mounted to avoid hydration mismatch */}
      {mounted && light ? (
        <Moon className="w-4 h-4" />
      ) : (
        <Sun className="w-4 h-4" />
      )}
    </button>
  );
}
