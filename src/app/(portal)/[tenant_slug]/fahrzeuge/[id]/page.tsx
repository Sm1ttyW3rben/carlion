/**
 * Fahrzeug-Detailseite
 *
 * ISR 60s — Galerie, technische Daten, Beschreibung, Kontaktformular.
 * Spec: MOD_11 Section 3 & 10
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBrandingForSlug } from "@/modules/dna-engine";
import { getPublicVehicleById } from "@/modules/inventory";
import { getPublicSettings } from "@/modules/website-builder";
import { db } from "@/server/db";
import { generatePublicCssVars } from "@/modules/website-builder/lib/branding-css";
import { WebsiteLayout } from "@/modules/website-builder/components/public/website-layout";
import { PhotoGallery } from "@/modules/website-builder/components/public/photo-gallery";
import { ContactForm } from "@/modules/website-builder/components/public/contact-form";

export const revalidate = 60;

interface Props {
  params: Promise<{ tenant_slug: string; id: string }>;
}

function formatPrice(priceStr: string | null, taxType: string): string {
  if (!priceStr) return "Preis auf Anfrage";
  const price = parseFloat(priceStr);
  if (isNaN(price)) return "Preis auf Anfrage";
  const formatted = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);
  return taxType === "margin" ? `${formatted} (MwSt. nicht ausweisbar)` : formatted;
}

function formatRegistration(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "numeric" }).format(date);
}

const FUEL_LABELS: Record<string, string> = {
  petrol: "Benzin", diesel: "Diesel", electric: "Elektro",
  hybrid_petrol: "Hybrid (Benzin)", hybrid_diesel: "Hybrid (Diesel)",
  lpg: "LPG", cng: "CNG", hydrogen: "Wasserstoff", other: "Sonstige",
};

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Schaltgetriebe", automatic: "Automatik",
  semi_automatic: "Halbautomatik", cvt: "CVT",
};

const CONDITION_LABELS: Record<string, string> = {
  used: "Gebrauchtfahrzeug", new: "Neufahrzeug",
  demo: "Vorführfahrzeug", old_timer: "Oldtimer",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant_slug, id } = await params;
  const [branding, vehicle] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicVehicleById(tenant_slug, id),
  ]);
  if (!branding || !vehicle) return { title: "Fahrzeug" };
  const label = `${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`;
  return {
    title: `${label} — ${branding.name}`,
    description: vehicle.description ?? `${label} bei ${branding.name}${branding.address?.city ? ` in ${branding.address.city}` : ""}`,
  };
}

export default async function FahrzeugDetailPage({ params }: Props) {
  const { tenant_slug, id } = await params;

  const [branding, settings, vehicle] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicSettings(tenant_slug, db),
    getPublicVehicleById(tenant_slug, id),
  ]);

  if (!branding) notFound();
  if (!settings?.isPublished) notFound();
  if (!vehicle) notFound();

  const cssVars = generatePublicCssVars(branding);
  const label = `${vehicle.make} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`;

  const specs: { label: string; value: string }[] = [
    vehicle.firstRegistration && { label: "Erstzulassung", value: formatRegistration(vehicle.firstRegistration) },
    vehicle.mileageKm !== null && { label: "Kilometerstand", value: `${new Intl.NumberFormat("de-DE").format(vehicle.mileageKm)} km` },
    vehicle.fuelType && { label: "Kraftstoff", value: FUEL_LABELS[vehicle.fuelType] ?? vehicle.fuelType },
    vehicle.transmission && { label: "Getriebe", value: TRANSMISSION_LABELS[vehicle.transmission] ?? vehicle.transmission },
    vehicle.powerKw !== null && { label: "Leistung", value: `${vehicle.powerKw} kW (${vehicle.powerPs ?? Math.round(vehicle.powerKw * 1.36)} PS)` },
    vehicle.colorExterior && { label: "Farbe", value: vehicle.colorExterior },
    vehicle.bodyType && { label: "Karosserie", value: vehicle.bodyType },
    vehicle.condition && { label: "Zustand", value: CONDITION_LABELS[vehicle.condition] ?? vehicle.condition },
    vehicle.huValidUntil && { label: "TÜV bis", value: formatRegistration(vehicle.huValidUntil) },
    vehicle.accidentFree !== null && { label: "Unfallfrei", value: vehicle.accidentFree ? "Ja" : "Nein" },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <WebsiteLayout branding={branding} tenantSlug={tenant_slug}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          {/* Back link */}
          <a
            href={`/${tenant_slug}/fahrzeuge`}
            style={{ color: "var(--brand-primary, #2563eb)", fontSize: "0.875rem", textDecoration: "none", display: "inline-block", marginBottom: "1.5rem" }}
          >
            ← Zurück zur Übersicht
          </a>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2.5rem" }}>
            {/* Left column: Gallery + Specs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2.5rem", alignItems: "start" }}>
              {/* Gallery */}
              <div>
                <PhotoGallery photos={vehicle.photos} vehicleLabel={label} />
              </div>

              {/* Core info */}
              <div>
                <h1 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.75rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                  {label}
                </h1>

                {/* Price */}
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--brand-primary, #2563eb)", marginBottom: "1.5rem" }}>
                  {formatPrice(vehicle.askingPriceGross, vehicle.taxType)}
                </p>

                {/* Specs table */}
                {specs.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
                    <tbody>
                      {specs.map((spec) => (
                        <tr key={spec.label} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "0.5rem 0.75rem 0.5rem 0", color: "#6b7280", whiteSpace: "nowrap", width: "40%" }}>
                            {spec.label}
                          </td>
                          <td style={{ padding: "0.5rem 0", fontWeight: 500 }}>
                            {spec.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Description */}
            {vehicle.description && (
              <div>
                <h2 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                  Beschreibung
                </h2>
                <div style={{ fontSize: "0.9375rem", color: "#374151", lineHeight: 1.75, whiteSpace: "pre-line" }}>
                  {vehicle.description}
                </div>
              </div>
            )}

            {/* Equipment */}
            {vehicle.equipment.length > 0 && (
              <div>
                <h2 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                  Ausstattung
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.375rem" }}>
                  {vehicle.equipment.map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#374151" }}>
                      <span style={{ color: "var(--brand-primary, #2563eb)", flexShrink: 0 }}>✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact form */}
            {settings.contactFormEnabled && (
              <div style={{ background: "#f9fafb", borderRadius: "var(--brand-radius, 0.5rem)", padding: "2rem" }}>
                <h2 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>
                  Fahrzeug anfragen
                </h2>
                <ContactForm tenantSlug={tenant_slug} vehicleId={vehicle.id} vehicleLabel={label} />
              </div>
            )}
          </div>

          {/* Schema.org Vehicle */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Vehicle",
                name: label,
                brand: { "@type": "Brand", name: vehicle.make },
                model: vehicle.model,
                offers: vehicle.askingPriceGross ? {
                  "@type": "Offer",
                  price: parseFloat(vehicle.askingPriceGross),
                  priceCurrency: "EUR",
                  availability: "https://schema.org/InStock",
                  seller: { "@type": "AutoDealer", name: branding.name },
                } : undefined,
              }),
            }}
          />
        </div>
      </WebsiteLayout>
    </>
  );
}
