import { NextRequest, NextResponse } from "next/server";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (isApi && unsafeMethods.has(request.method)) {
    const configured = process.env.NEXTAUTH_URL;
    const expectedOrigin = configured ? new URL(configured).origin : request.nextUrl.origin;
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const site = request.headers.get("sec-fetch-site");
    let sourceOrigin = origin;
    if (!sourceOrigin && referer) {
      try { sourceOrigin = new URL(referer).origin; }
      catch { sourceOrigin = "invalid"; }
    }
    // Native/API clients can omit browser metadata. Browsers must not submit
    // authenticated mutations from another origin, including sibling subdomains.
    if ((sourceOrigin && sourceOrigin !== expectedOrigin) ||
      (!sourceOrigin && (site === "cross-site" || site === "same-site"))) {
      return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
    const length = Number(request.headers.get("content-length") || 0);
    const upload = request.nextUrl.pathname === "/api/uploads";
    const document = ["/api/quotations/upload", "/api/quotations/extract"].includes(request.nextUrl.pathname);
    const limit = upload ? 51 * 1024 * 1024 : document ? 11 * 1024 * 1024 : 1024 * 1024;
    if (length > limit) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  if (isApi) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const development = process.env.NODE_ENV === "development";
  // Restrict cross-origin media and uploads to this project's storage origin.
  let storageOrigin = "";
  if (process.env.FILE_STORAGE === "supabase" && process.env.SUPABASE_URL) {
    const storage = new URL(process.env.SUPABASE_URL);
    if (storage.protocol === "https:") storageOrigin = ` ${storage.origin}`;
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storageOrigin}`,
    "font-src 'self' data:",
    `connect-src 'self'${storageOrigin}${development ? " ws: wss:" : ""}`,
    `media-src 'self' blob:${storageOrigin}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NEXTAUTH_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  // Next reads this request header to nonce its framework/streaming scripts.
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|brand/|offline.html|sw.js|manifest.webmanifest|favicon.ico).*)"],
};
