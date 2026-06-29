/**
 * Client-safe constants for the global company scope.
 *
 * Kept in its own module (no server-only imports) so both client components
 * (the switcher) and the server helper can share the cookie name.
 */

/** Cookie that stores the globally selected company id ("" / absent = all companies). */
export const COMPANY_SCOPE_COOKIE = "company-scope";
