/**
 * Händler-Website Startseite
 *
 * SSR/ISR — SEO-optimiert, White-Label.
 * Theming via CSS Custom Properties aus PublicBranding.
 * Spec: MOD_11 Section 3 & 5.1
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBrandingForSlug } from "@/modules/dna-engine";
import { getPublicVehiclesForSlug } from "@/modules/inventory";
import { db } from "@/server/db";
import { getPublicSettings } from "@/modules/website-builder";
import { generatePublicCssVars } from "@/modules/website-builder/lib/branding-css";
import { WebsiteLayout } from "@/modules/website-builder/components/public/website-layout";
import { HeroBanner } from "@/modules/website-builder/components/public/hero-banner";
import { VehicleCard } from "@/modules/website-builder/components/public/vehicle-card";
import { ContactBox } from "@/modules/website-builder/components/public/contact-box";

export const revalidate = 60;

interface Props {
  params: Promise<{ tenant_slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant_slug } = await params;
  const [branding, settings] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicSettings(tenant_slug, db),
  ]);

  if (!branding || !settings?.isPublished) {
    return { title: "Coming Soon" };
  }

  return {
    title: settings.metaTitle ?? `${branding.name} — Gebrauchtwagen`,
    description: settings.metaDescription ?? `Gebrauchtwagen beim ${branding.name} in ${branding.address?.city ?? "Ihrer Nähe"}`,
  };
}

export default async function PortalHomePage({ params }: Props) {
  const { tenant_slug } = await params;

  const [branding, settings, vehicles] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicSettings(tenant_slug, db),
    getPublicVehiclesForSlug(tenant_slug, { limit: 6, sort: "newest" }),
  ]);

  if (!branding) notFound();

  // Publish gate: show Coming Soon if not published
  if (!settings?.isPublished) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>{branding.name}</h1>
        <p style={{ color: "#6b7280", fontSize: "1.125rem" }}>Unsere Website ist bald für Sie erreichbar.</p>
        {branding.phone && <p style={{ marginTop: "1rem", color: "#374151" }}>Erreichen Sie uns unter: {branding.phone}</p>}
      </div>
    );
  }

  const cssVars = generatePublicCssVars(branding);
  const featuredVehicles = vehicles.items.filter((v) => v.featured).slice(0, 6);
  const showVehicles = featuredVehicles.length > 0 ? featuredVehicles : vehicles.items.slice(0, 6);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <WebsiteLayout branding={branding} tenantSlug={tenant_slug} googleAnalyticsId={settings.googleAnalyticsId}>

        {/* Hero */}
        <HeroBanner
          headline={settings.heroHeadline ?? `Willkommen bei ${branding.name}`}
          subheadline={settings.heroSubheadline ?? branding.tagline}
          ctaText={settings.heroCtatext}
          ctaHref={`/${tenant_slug}/fahrzeuge`}
        />

        {/* Featured vehicles */}
        {showVehicles.length > 0 && (
          <section style={{ padding: "4rem 1.5rem", maxWidth: "1280px", margin: "0 auto" }}>
            <h2 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem", textAlign: "center" }}>
              {featuredVehicles.length > 0 ? "Highlight-Fahrzeuge" : "Aktuelle Fahrzeuge"}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {showVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  href={`/${tenant_slug}/fahrzeuge/${v.id}`}
                />
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <a
                href={`/${tenant_slug}/fahrzeuge`}
                style={{
                  display: "inline-block",
                  border: "2px solid var(--brand-primary, #2563eb)",
                  color: "var(--brand-primary, #2563eb)",
                  padding: "0.625rem 1.5rem",
                  borderRadius: "var(--brand-radius, 0.375rem)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Alle Fahrzeuge ansehen
              </a>
            </div>
          </section>
        )}

        {/* Contact box */}
        <section style={{ background: "#f9fafb", padding: "4rem 1.5rem" }}>
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <h2 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>
              Kontakt & Öffnungszeiten
            </h2>
            <ContactBox branding={branding} />
          </div>
        </section>

        {/* Schema.org AutoDealer */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "AutoDealer",
              name: branding.name,
              telephone: branding.phone,
              email: branding.email,
              address: branding.address ? {
                "@type": "PostalAddress",
                streetAddress: branding.address.street,
                postalCode: branding.address.zip,
                addressLocality: branding.address.city,
                addressCountry: "DE",
              } : undefined,
            }),
          }}
        />
      </WebsiteLayout>
    </>
  );
}
