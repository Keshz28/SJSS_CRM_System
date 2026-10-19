"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, FolderOpen, Home, Inbox, Menu } from "lucide-react";
import { useMobileNav } from "./MobileNavProvider";
export function MobileBottomNav() {
  const path = usePathname();
  const { setOpen } = useMobileNav();
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-dx-line bg-dx-bg/95 backdrop-blur grid grid-cols-5 px-2 pt-1"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      {[
        { href: "/dashboard", name: "Home", icon: Home },
        { href: "/projects", name: "Projects", icon: FolderOpen },
        { href: "/site-visits/new", name: "Capture", icon: Camera },
        { href: "/inbox", name: "Inbox", icon: Inbox },
      ].map((item) => (
        <Link
          key={item.name}
          href={item.href}
          aria-current={path === item.href || (item.href === "/inbox" && path.startsWith("/work-groups")) ? "page" : undefined}
          className={`flex flex-col items-center justify-center gap-1 min-h-14 text-[11px] ${path === item.href || (item.href === "/projects" && path.startsWith("/projects/")) || (item.href === "/inbox" && path.startsWith("/work-groups")) ? "text-dx-accent" : "text-dx-ink-muted"}`}
        >
          <item.icon className="w-5 h-5" />
          {item.name}
        </Link>
      ))}
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-1 min-h-14 text-[11px] text-dx-ink-muted"
      >
        <Menu className="w-5 h-5" />
        More
      </button>
    </nav>
  );
}
