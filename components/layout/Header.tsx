"use client";

import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { CompanySwitcher } from "./CompanySwitcher";
import { useMobileNav } from "./MobileNavProvider";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession();
  const { setOpen } = useMobileNav();
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 bg-dx-bg/95 backdrop-blur border-b border-dx-line px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Hamburger — opens the sidebar drawer on mobile only. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="lg:hidden -ml-1 p-2 rounded-lg text-dx-ink-muted hover:text-dx-ink hover:bg-dx-surface-hover flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-dx-ink truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-dx-ink-muted mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <ThemeToggle />
          <NotificationBell />
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
      </div>

      {/* Global company scope — applies to the whole system, on every page. */}
      <CompanySwitcher />
    </header>
  );
}
