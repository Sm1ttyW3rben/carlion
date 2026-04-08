/**
 * Kontaktseite
 *
 * ISR 300s — Kontaktformular, Adresse, Öffnungszeiten.
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
import { ContactForm } from "@/modules/website-builder/components/public/contact-form";

export const revalidate = 300;

interface Props {
  params: Promise<{ tenant_slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant_slug } = await params;
  const branding = await getPublicBrandingForSlug(tenant_slug);
  if (!branding) return { title: "Kontakt" };
  return {
    title: `Kontakt — ${branding.name}`,
    description: `Kontaktieren Sie ${branding.name}`,
  };
}

export default async function KontaktPage({ params }: Props) {
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
            Kontakt
          </h1>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "3rem", alignItems: "start" }}>
            {/* Left: Contact info + hours */}
            <div>
              <ContactBox branding={branding} />

              {/* Google Maps */}
              {branding.googleMapsUrl && (
                <div style={{ marginTop: "1.5rem" }}>
                  <a
                    href={branding.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      border: "2px solid var(--brand-primary, #2563eb)",
                      color: "var(--brand-primary, #2563eb)",
                      padding: "0.5rem 1rem",
                      borderRadius: "var(--brand-radius, 0.375rem)",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    Anfahrt auf Google Maps
                  </a>
                </div>
              )}
            </div>

            {/* Right: Contact form */}
            {settings.contactFormEnabled && (
              <div>
                <h2 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.125rem", fontWeight: 700, marginBottom: "1rem" }}>
                  Nachricht senden
                </h2>
                <ContactForm tenantSlug={tenant_slug} />
              </div>
            )}
          </div>
        </div>
      </WebsiteLayout>
    </>
  );
}
