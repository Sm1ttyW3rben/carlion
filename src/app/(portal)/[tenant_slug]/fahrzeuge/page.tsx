/**
 * Öffentliche Fahrzeugliste
 *
 * ISR 60s — zeigt alle veröffentlichten Fahrzeuge des Händlers.
 * Filter erfolgt client-seitig via VehicleFilter-Komponente.
 * Spec: MOD_11 Section 3
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicBrandingForSlug } from "@/modules/dna-engine";
import { getPublicVehiclesForSlug } from "@/modules/inventory";
import { getPublicSettings } from "@/modules/website-builder";
import { db } from "@/server/db";
import { generatePublicCssVars } from "@/modules/website-builder/lib/branding-css";
import { WebsiteLayout } from "@/modules/website-builder/components/public/website-layout";
import { VehicleFilter } from "@/modules/website-builder/components/public/vehicle-filter";

export const revalidate = 60;

interface Props {
  params: Promise<{ tenant_slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant_slug } = await params;
  const branding = await getPublicBrandingForSlug(tenant_slug);
  if (!branding) return { title: "Fahrzeuge" };
  return {
    title: `Fahrzeuge — ${branding.name}`,
    description: `Alle verfügbaren Fahrzeuge bei ${branding.name}`,
  };
}

export default async function FahrzeugePage({ params }: Props) {
  const { tenant_slug } = await params;

  const [branding, settings, vehicles] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicSettings(tenant_slug, db),
    getPublicVehiclesForSlug(tenant_slug, { limit: 100, sort: "newest" }),
  ]);

  if (!branding) notFound();
  if (!settings?.isPublished) notFound();

  const cssVars = generatePublicCssVars(branding);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <WebsiteLayout branding={branding} tenantSlug={tenant_slug}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <h1 style={{ fontFamily: "var(--font-heading, sans-serif)", fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Fahrzeugbestand
          </h1>
          <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
            {vehicles.items.length} {vehicles.items.length === 1 ? "Fahrzeug" : "Fahrzeuge"} verfügbar
          </p>

          <VehicleFilter vehicles={vehicles.items} tenantSlug={tenant_slug} />
        </div>
      </WebsiteLayout>
    </>
  );
}
