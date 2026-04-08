/**
 * Next.js Middleware — Subdomain Routing
 *
 * Maps `{tenant_slug}.{domain}` → `/{tenant_slug}/...`
 * so the portal pages are served on the dealer's subdomain.
 *
 * Phase 1: Subdomain-based.
 * Phase 2: Custom domains (CNAME-based) with SSL.
 *
 * Spec: MOD_11 Section 5.2 (Kein separater Frontend-Build)
 * Architecture: 01_ARCHITECTURE.md Section 10 (Public Delivery)
 */

import { NextRequest, NextResponse } from "next/server";

// Subdomains that are part of the platform — do NOT route to portal
const PLATFORM_SUBDOMAINS = new Set(["www", "app", "api", "dashboard", "admin"]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const url = request.nextUrl;

  // Extract subdomain: e.g. "autohaus-mueller.carlion.de" → "autohaus-mueller"
  // Works locally too: "autohaus-mueller.localhost:3000" → "autohaus-mueller"
  const hostParts = host.split(".");

  // Only proceed if we have a subdomain (at least 3 parts, e.g. sub.domain.tld)
  // or in localhost dev mode (sub.localhost)
  const isLocalhost = host.includes("localhost");
  const hasSubdomain = isLocalhost ? hostParts.length >= 2 : hostParts.length >= 3;

  if (!hasSubdomain) return NextResponse.next();

  const subdomain = hostParts[0] ?? "";

  // Skip platform-internal subdomains
  if (!subdomain || PLATFORM_SUBDOMAINS.has(subdomain)) return NextResponse.next();

  // Skip paths that are already API routes, Next.js internals, or _next
  const pathname = url.pathname;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml")
  ) {
    return NextResponse.next();
  }

  // Rewrite to portal route: /{subdomain}{pathname}
  // This resolves to app/(portal)/[tenant_slug]/... via App Router
  const rewrittenUrl = url.clone();
  rewrittenUrl.pathname = `/${subdomain}${pathname === "/" ? "" : pathname}`;

  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
