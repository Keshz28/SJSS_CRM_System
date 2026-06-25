"use client";

import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession();
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 bg-dx-bg/95 backdrop-blur border-b border-dx-line px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-dx-ink">{title}</h1>
        {subtitle && (
          <p className="text-sm text-dx-ink-muted mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button className="w-9 h-9 rounded-lg bg-dx-surface border border-dx-line flex items-center justify-center text-dx-ink-muted hover:text-dx-ink hover:border-dx-accent/40 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-dx-accent to-dx-accent-2 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-dx-ink leading-tight">
              {session?.user?.name}
            </p>
            <p className="text-xs text-dx-ink-faint">
              {session?.user?.role === "ADMIN" ? "Administrator" : "User"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
