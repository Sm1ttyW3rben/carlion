/**
 * Über-uns-Seite
 *
 * ISR 300s — Händlerporträt, Standortinformationen.
 * Spec: MOD_11 Section 3
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBrandingForSlug } from "@/modules/dna-engine";
import { getPublicSettings } from "@/modules/website-builder";
import { db } from "@/server/db";
import { generatePublicCssVars } from "@/modules/website-builder/lib/branding-css";
import { WebsiteLayout } from "@/modules/website-builder/components/public/website-layout";
import { ContactBox } from "@/modules/website-builder/components/public/contact-box";

export const revalidate = 300;

interface Props {
  params: Promise<{ tenant_slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant_slug } = await params;
  const branding = await getPublicBrandingForSlug(tenant_slug);
  if (!branding) return { title: "Über uns" };
  return {
    title: `Über uns — ${branding.name}`,
    description: `Erfahren Sie mehr über ${branding.name}`,
  };
}

export default async function UeberUnsPage({ params }: Props) {
  const { tenant_slug } = await params;

  const [branding, settings] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicSettings(tenant_slug, db),
  ]);

  if (!branding) notFound();
  if (!settings?.isPublished) notFound();

  const cssVars = generatePublicCssVars(branding);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <WebsiteLayout branding={branding} tenantSlug={tenant_slug}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <h1 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "2rem", fontWeight: 800, marginBottom: "2rem" }}>
            Über uns
          </h1>

          {/* About text */}
          {settings.aboutText ? (
            <div style={{ fontSize: "1rem", color: "#374151", lineHeight: 1.85, whiteSpace: "pre-line", marginBottom: "3rem" }}>
              {settings.aboutText}
            </div>
          ) : (
            <div style={{ fontSize: "1rem", color: "#374151", lineHeight: 1.85, marginBottom: "3rem" }}>
              <p>
                Willkommen bei <strong>{branding.name}</strong>
                {branding.address?.city ? ` in ${branding.address.city}` : ""}.
                Wir sind Ihr zuverlässiger Partner rund um das Thema Gebrauchtwagen.
              </p>
              {branding.tagline && (
                <p style={{ marginTop: "1rem", fontStyle: "italic", color: "#6b7280" }}>
                  „{branding.tagline}"
                </p>
              )}
            </div>
          )}

          {/* Contact & Opening Hours */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "2rem" }}>
            <h2 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem" }}>
              Kontakt & Öffnungszeiten
            </h2>
            <ContactBox branding={branding} />
          </div>

          {/* Google Maps link */}
          {branding.googleMapsUrl && (
            <div style={{ marginTop: "2rem" }}>
              <a
                href={branding.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  background: "var(--brand-primary, #2563eb)",
                  color: "var(--brand-on-primary, #ffffff)",
                  padding: "0.625rem 1.25rem",
                  borderRadius: "var(--brand-radius, 0.375rem)",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                }}
              >
                Anfahrt auf Google Maps
              </a>
            </div>
          )}
        </div>
      </WebsiteLayout>
    </>
  );
}
