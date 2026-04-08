/**
 * Datenschutzerklärung — DSGVO-Pflichtseite.
 *
 * ISR 300s — Template mit Tenant-spezifischen Daten.
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
  if (!branding) return { title: "Datenschutz" };
  return { title: `Datenschutz — ${branding.name}` };
}

export default async function DatenschutzPage({ params }: Props) {
  const { tenant_slug } = await params;

  const [branding, settings, imprint] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicSettings(tenant_slug, db),
    getPublicImprintForSlug(tenant_slug),
  ]);

  if (!branding) notFound();
  if (!settings?.isPublished) notFound();

  const cssVars = generatePublicCssVars(branding);
  const dealerName = imprint?.name ?? branding.name;
  const dealerEmail = imprint?.email ?? branding.email;

  const sectionStyle: React.CSSProperties = { marginBottom: "2rem" };
  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--font-heading, sans-serif)",
    fontSize: "1.125rem",
    fontWeight: 700,
    marginBottom: "0.75rem",
    marginTop: "0.5rem",
    color: "#111827",
  };
  const textStyle: React.CSSProperties = {
    fontSize: "0.9375rem",
    color: "#374151",
    lineHeight: 1.8,
  };
  const pStyle: React.CSSProperties = { marginBottom: "0.75rem" };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <WebsiteLayout branding={branding} tenantSlug={tenant_slug}>
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <h1 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "2rem", fontWeight: 800, marginBottom: "2rem" }}>
            Datenschutzerklärung
          </h1>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>1. Datenschutz auf einen Blick</h2>
            <div style={textStyle}>
              <h3 style={{ ...headingStyle, fontSize: "1rem" }}>Allgemeine Hinweise</h3>
              <p style={pStyle}>
                Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
                personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene
                Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.
              </p>

              <h3 style={{ ...headingStyle, fontSize: "1rem" }}>Datenerfassung auf dieser Website</h3>
              <p style={pStyle}>
                Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber.
                Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
              </p>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>2. Verantwortlicher</h2>
            <div style={textStyle}>
              <p style={pStyle}><strong>{dealerName}</strong></p>
              {imprint?.address && (
                <address style={{ fontStyle: "normal", marginBottom: "0.75rem" }}>
                  {imprint.address.street}<br />
                  {imprint.address.zip} {imprint.address.city}
                </address>
              )}
              {dealerEmail && (
                <p style={pStyle}>E-Mail: <a href={`mailto:${dealerEmail}`} style={{ color: "var(--brand-primary, #2563eb)" }}>{dealerEmail}</a></p>
              )}
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>3. Datenerfassung auf dieser Website</h2>
            <div style={textStyle}>
              <h3 style={{ ...headingStyle, fontSize: "1rem" }}>Kontaktformular</h3>
              <p style={pStyle}>
                Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus
                dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks
                Bearbeitung der Anfrage und für den Fall von Anschlussfragen bei uns gespeichert.
                Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
              </p>
              <p style={pStyle}>
                Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO,
                sofern Ihre Anfrage mit der Erfüllung eines Vertrags zusammenhängt oder zur
                Durchführung vorvertraglicher Maßnahmen erforderlich ist. In allen übrigen Fällen
                beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven
                Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO).
              </p>
              <p style={pStyle}>
                Die von Ihnen im Kontaktformular eingegebenen Daten verbleiben bei uns, bis Sie uns
                zur Löschung auffordern, Ihre Einwilligung zur Speicherung widerrufen oder der Zweck
                für die Datenspeicherung entfällt. Zwingende gesetzliche Bestimmungen – insbesondere
                Aufbewahrungsfristen – bleiben unberührt.
              </p>

              <h3 style={{ ...headingStyle, fontSize: "1rem" }}>Server-Log-Dateien</h3>
              <p style={pStyle}>
                Der Provider der Seiten erhebt und speichert automatisch Informationen in so
                genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt.
                Dies sind: Browsertyp und Browserversion, verwendetes Betriebssystem, Referrer URL,
                Hostname des zugreifenden Rechners, Uhrzeit der Serveranfrage und IP-Adresse.
              </p>
              <p style={pStyle}>
                Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen.
                Die Erfassung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
              </p>
            </div>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>4. Ihre Rechte</h2>
            <div style={textStyle}>
              <p style={pStyle}>
                Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und
                Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem
                ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Wenn Sie eine
                Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung
                jederzeit für die Zukunft widerrufen.
              </p>
              <p style={pStyle}>
                Außerdem haben Sie das Recht, unter bestimmten Umständen die Einschränkung der
                Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Des Weiteren steht Ihnen
                ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
              </p>
              <p style={pStyle}>
                Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich jederzeit an
                uns wenden.
              </p>
            </div>
          </div>

          {settings.googleAnalyticsId && (
            <div style={sectionStyle}>
              <h2 style={headingStyle}>5. Analyse-Tools und Werbung</h2>
              <div style={textStyle}>
                <h3 style={{ ...headingStyle, fontSize: "1rem" }}>Google Analytics</h3>
                <p style={pStyle}>
                  Diese Website nutzt Funktionen des Webanalysedienstes Google Analytics. Anbieter
                  ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.
                  Google Analytics ermöglicht es dem Websitebetreiber, das Verhalten der
                  Websitebesucher zu analysieren.
                </p>
                <p style={pStyle}>
                  Die Rechtsgrundlage für den Einsatz von Google Analytics ist Art. 6 Abs. 1 lit. a
                  DSGVO (Einwilligung). Weitere Informationen zum Umgang mit Nutzerdaten bei Google
                  Analytics finden Sie in der Datenschutzerklärung von Google.
                </p>
              </div>
            </div>
          )}
        </div>
      </WebsiteLayout>
    </>
  );
}
