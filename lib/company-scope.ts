import { cookies } from "next/headers";
import { getCompanies, type CompanyOption } from "@/lib/companies";
import { COMPANY_SCOPE_COOKIE } from "@/lib/company-scope-constants";

export interface CompanyScope {
  /** All companies, for rendering the switcher. */
  companies: CompanyOption[];
  /** The selected company id, or "" when "All companies" is active. */
  companyId: string;
  /** Convenience: the selected company (or null when "All companies"). */
  company: CompanyOption | null;
}

/**
 * Reads the globally selected company from the request cookie.
 *
 * This is the single source of truth for company filtering across every page.
 * The id is validated against the real company list, so a stale/invalid cookie
 * value safely falls back to "All companies".
 */
export async function getCompanyScope(): Promise<CompanyScope> {
  const companies = await getCompanies();
  const raw = (await cookies()).get(COMPANY_SCOPE_COOKIE)?.value ?? "";
  const company = companies.find((c) => c.id === raw) ?? null;
  return { companies, companyId: company?.id ?? "", company };
}

/**
 * Prisma `where` fragment for models that carry a `companyId`
 * (Quotation, SiteVisit). Returns `{}` for "All companies".
 */
export function scopeWhere(companyId: string): Record<string, unknown> {
  return companyId ? { companyId } : {};
}

/**
 * Customers belong directly to a company, even before their first quotation.
 * Legacy customers without a known company remain visible in All companies
 * with an explicit assignment notice.
 */
export function customerScopeWhere(companyId: string): Record<string, unknown> {
  return companyId ? { companyId } : {};
}

/** Explicit API filter overrides the view cookie; absent filters inherit it. */
export async function getRequestedCompany(req: { nextUrl: URL }) {
  const scope = await getCompanyScope();
  const requested = req.nextUrl.searchParams.get("company");
  return requested === null ? scope.companyId : requested;
}
