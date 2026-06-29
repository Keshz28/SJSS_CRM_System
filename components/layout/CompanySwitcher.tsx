"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { COMPANY_SCOPE_COOKIE } from "@/lib/company-scope-constants";
import { useCompanyScope } from "./CompanyScopeProvider";

/**
 * Global company selector shown in the header on every page.
 *
 * Writes the choice to a long-lived cookie and refreshes the route so all
 * server components re-read the scope. The selection therefore persists across
 * navigation and reloads — the whole app stays pinned to one company until
 * changed back to "All companies".
 */
export function CompanySwitcher() {
  const { companies, companyId } = useCompanyScope();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Nothing to switch between if there's only one (or no) company.
  if (companies.length < 2) return null;

  function select(id: string) {
    if (id === companyId) return;
    // 1 year, site-wide. Not httpOnly so the client can set it directly.
    document.cookie = `${COMPANY_SCOPE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
      active
        ? "bg-gradient-to-r from-dx-accent to-dx-accent-2 text-white shadow-sm"
        : "text-dx-ink-muted hover:text-dx-ink hover:bg-dx-surface-hover"
    }`;

  return (
    <div
      className={`mt-3 flex items-center gap-1 bg-dx-surface border border-dx-line rounded-xl p-1 w-fit max-w-full overflow-x-auto transition-opacity ${
        isPending ? "opacity-60" : ""
      }`}
      role="group"
      aria-label="Filter the whole system by company"
      title="Choose which company to view across the whole system"
    >
      <Building2 className="w-4 h-4 text-dx-ink-faint ml-1.5 mr-0.5 flex-shrink-0" />
      <button type="button" onClick={() => select("")} className={pill(!companyId)}>
        All companies
      </button>
      {companies.map((co) => (
        <button
          key={co.id}
          type="button"
          onClick={() => select(co.id)}
          className={pill(companyId === co.id)}
        >
          {co.name}
        </button>
      ))}
    </div>
  );
}
