// Return only to the visit list, keeping its supported filters and display.
export function siteVisitReturnTo(value?: string): string {
  if (!value) return "/site-visits";
  try {
    const url = new URL(value, "https://crm.invalid");
    if (url.origin !== "https://crm.invalid" || url.pathname !== "/site-visits") return "/site-visits";
    const params = new URLSearchParams();
    for (const key of ["search", "status", "view", "page"]) {
      const entry = url.searchParams.get(key);
      if (entry) params.set(key, entry);
    }
    return `/site-visits${params.size ? `?${params}` : ""}`;
  } catch {
    return "/site-visits";
  }
}

export function siteVisitDetailHref(id: string, returnTo?: string): string {
  return `/site-visits/${id}${returnTo ? `?${new URLSearchParams({ returnTo: siteVisitReturnTo(returnTo) })}` : ""}`;
}
