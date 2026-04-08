/**
 * Impressum — rechtlich vorgeschriebene Pflichtseite.
 *
 * ISR 300s — generiert aus imprint_data + Händlerdaten.
 * Spec: MOD_11 Section 3
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBrandingForSlug, getPublicImprintForSlug } from "@/modules/dna-engine";
import { getPublicSettings } from "@/modules/website-builder";
import { db } from "@/server/db";
import { generatePublicCssVars } from "@/modules/website-builder/lib/branding-css";
import { WebsiteLayout } from "@/modules/website-builder/components/public/website-layout";

export const revalidate = 300;

interface Props {
  params: Promise<{ tenant_slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant_slug } = await params;
  const branding = await getPublicBrandingForSlug(tenant_slug);
  if (!branding) return { title: "Impressum" };
  return { title: `Impressum — ${branding.name}` };
}

export default async function ImpressumPage({ params }: Props) {
  const { tenant_slug } = await params;

  const [branding, settings, imprint] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicSettings(tenant_slug, db),
    getPublicImprintForSlug(tenant_slug),
  ]);

  if (!branding) notFound();
  if (!settings?.isPublished) notFound();

  const cssVars = generatePublicCssVars(branding);

  const sectionStyle: React.CSSProperties = {
    marginBottom: "2rem",
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--font-heading, sans-serif)",
    fontSize: "1rem",
    fontWeight: 700,
    marginBottom: "0.5rem",
    color: "#111827",
  };

  const textStyle: React.CSSProperties = {
    fontSize: "0.9375rem",
    color: "#374151",
    lineHeight: 1.75,
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <WebsiteLayout branding={branding} tenantSlug={tenant_slug}>
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <h1 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "2rem", fontWeight: 800, marginBottom: "2rem" }}>
            Impressum
          </h1>

          {/* Angaben gemäß §5 TMG */}
          <div style={sectionStyle}>
            <h2 style={headingStyle}>Angaben gemäß §5 TMG</h2>
            <div style={textStyle}>
              <p><strong>{imprint?.name ?? branding.name}</strong></p>
              {imprint?.address && (
                <address style={{ fontStyle: "normal", marginTop: "0.25rem" }}>
                  {imprint.address.street}<br />
                  {imprint.address.zip} {imprint.address.city}
                  {imprint.address.country && imprint.address.country !== "DE" && <><br />{imprint.address.country}</>}
                </address>
              )}
            </div>
          </div>

          {/* Kontakt */}
          <div style={sectionStyle}>
            <h2 style={headingStyle}>Kontakt</h2>
            <div style={textStyle}>
              {imprint?.phone && <p>Telefon: {imprint.phone}</p>}
              {imprint?.email && (
                <p>E-Mail: <a href={`mailto:${imprint.email}`} style={{ color: "var(--brand-primary, #2563eb)" }}>{imprint.email}</a></p>
              )}
            </div>
          </div>

          {/* Handelsregister */}
          {imprint?.imprintData?.hrb && (
            <div style={sectionStyle}>
              <h2 style={headingStyle}>Handelsregister</h2>
              <div style={textStyle}>
                <p>Registernummer: {imprint.imprintData.hrb}</p>
                {imprint.imprintData.court && <p>Registergericht: {imprint.imprintData.court}</p>}
              </div>
            </div>
          )}

          {/* Umsatzsteuer-ID */}
          {imprint?.imprintData?.ust_id && (
            <div style={sectionStyle}>
              <h2 style={headingStyle}>Umsatzsteuer-ID</h2>
              <div style={textStyle}>
                <p>Umsatzsteuer-Identifikationsnummer gemäß §27a UStG: {imprint.imprintData.ust_id}</p>
              </div>
            </div>
          )}

          {/* Verantwortlicher */}
          {imprint?.imprintData?.managing_director && (
            <div style={sectionStyle}>
              <h2 style={headingStyle}>Verantwortlicher i.S.d. § 18 Abs. 2 MStV</h2>
              <div style={textStyle}>
                <p>{imprint.imprintData.managing_director}</p>
                {imprint.address && (
                  <address style={{ fontStyle: "normal" }}>
                    {imprint.address.street}, {imprint.address.zip} {imprint.address.city}
                  </address>
                )}
              </div>
            </div>
          )}

          {/* Haftungsausschluss */}
          <div style={sectionStyle}>
            <h2 style={{ ...headingStyle, fontSize: "1.125rem", marginTop: "1rem" }}>Haftungsausschluss</h2>
            <div style={textStyle}>
              <h3 style={headingStyle}>Haftung für Inhalte</h3>
              <p>
                Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
                Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
                Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten
                nach den allgemeinen Gesetzen verantwortlich.
              </p>
            </div>
          </div>
        </div>
      </WebsiteLayout>
    </>
  );
}
