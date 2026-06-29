"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  BarChart2,
  LayoutGrid,
  Camera,
  Inbox,
  UserCog,
  Send,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useMobileNav } from "./MobileNavProvider";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Site Visits", href: "/site-visits", icon: Camera },
  { name: "Quotations", href: "/quotations", icon: FileText },
  { name: "Kanban", href: "/kanban", icon: LayoutGrid },
  { name: "Reports", href: "/reports", icon: BarChart2 },
  { name: "Inbox", href: "/inbox", icon: Inbox },
];

const adminNavigation = [
  { name: "Manage Users", href: "/admin/users", icon: UserCog },
  { name: "Send Message", href: "/admin/messages", icon: Send },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const { open, setOpen } = useMobileNav();

  // Close the mobile drawer whenever the route changes (e.g. a nav link tap).
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <>
      {/* Backdrop — mobile only, dims the page behind the open drawer. */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[45] bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-[#0A1330] border-r border-white/5 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-dx-accent to-dx-accent-2 flex items-center justify-center flex-shrink-0 shadow-lg shadow-dx-accent/30">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">SJSS CRM</p>
            <p className="text-white/50 text-xs">Management System</p>
          </div>
          {/* Close button — mobile only. */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="ml-auto p-1.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-3">
          Main Menu
        </p>
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                isActive
                  ? "bg-gradient-to-r from-dx-accent to-dx-accent-2 text-white shadow-lg shadow-dx-accent/20"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.name}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-3 mt-6">
              Admin
            </p>
            {adminNavigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                    isActive
                      ? "bg-gradient-to-r from-dx-accent to-dx-accent-2 text-white shadow-lg shadow-dx-accent/20"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="px-4 pb-6 space-y-1 border-t border-white/10 pt-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-red-500/20 hover:text-red-300 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
      </aside>
    </>
  );
}
