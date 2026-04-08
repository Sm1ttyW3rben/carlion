/**
 * WebsiteLayout — public website header + footer.
 *
 * Reads only CSS variables set by the portal pages from PublicBranding.
 * No shadcn/ui — lean component system for the public website.
 *
 * Spec: MOD_11 Section 10
 */

import Link from "next/link";
import type { PublicBranding } from "@/modules/dna-engine";

interface WebsiteLayoutProps {
  branding: PublicBranding;
  tenantSlug: string;
  googleAnalyticsId?: string | null;
  children: React.ReactNode;
}

export function WebsiteLayout({ branding, tenantSlug, googleAnalyticsId, children }: WebsiteLayoutProps) {
  const base = `/${tenantSlug}`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-body, sans-serif)", background: "var(--brand-bg, #ffffff)", color: "var(--brand-text, #111827)" }}>
      {/* Google Analytics 4 */}
      {googleAnalyticsId && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${googleAnalyticsId}');`,
            }}
          />
        </>
      )}
      {/* Header */}
      <header style={{ background: "var(--brand-bg, #ffffff)", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: "4rem" }}>
          {/* Logo / Name */}
          <Link href={base} style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none" }}>
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt={branding.name} style={{ height: "2.5rem", objectFit: "contain" }} />
            ) : (
              <span style={{ fontFamily: "var(--font-heading, sans-serif)", fontWeight: 700, fontSize: "1.25rem", color: "var(--brand-primary, #2563eb)" }}>
                {branding.name}
              </span>
            )}
          </Link>

          {/* Navigation */}
          <nav style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <NavLink href={`${base}/fahrzeuge`}>Fahrzeuge</NavLink>
            <NavLink href={`${base}/ueber-uns`}>Über uns</NavLink>
            <NavLink href={`${base}/kontakt`}>Kontakt</NavLink>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* Footer */}
      <footer style={{ background: "#111827", color: "#d1d5db", padding: "2rem 1.5rem", marginTop: "auto" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem" }}>
          <div>
            <p style={{ fontWeight: 700, color: "#f9fafb", marginBottom: "0.5rem" }}>{branding.name}</p>
            {branding.address && (
              <address style={{ fontStyle: "normal", fontSize: "0.875rem", lineHeight: 1.6 }}>
                {branding.address.street}<br />
                {branding.address.zip} {branding.address.city}
              </address>
            )}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "#f9fafb", marginBottom: "0.5rem" }}>Kontakt</p>
            {branding.phone && <p style={{ fontSize: "0.875rem" }}>{branding.phone}</p>}
            {branding.email && <p style={{ fontSize: "0.875rem" }}>{branding.email}</p>}
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "#f9fafb", marginBottom: "0.5rem" }}>Rechtliches</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.875rem" }}>
              <Link href={`${base}/impressum`} style={{ color: "#9ca3af", textDecoration: "none" }}>Impressum</Link>
              <Link href={`${base}/datenschutz`} style={{ color: "#9ca3af", textDecoration: "none" }}>Datenschutz</Link>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: "1280px", margin: "1.5rem auto 0", borderTop: "1px solid #374151", paddingTop: "1rem", fontSize: "0.75rem", color: "#6b7280", textAlign: "center" }}>
          © {new Date().getFullYear()} {branding.name}
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: "0.9375rem", color: "var(--brand-text, #374151)", textDecoration: "none", fontWeight: 500 }}>
      {children}
    </Link>
  );
}
