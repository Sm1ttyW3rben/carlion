/**
 * Dynamic sitemap for the public dealer website.
 *
 * Generates sitemap.xml entries for all published vehicles.
 * Spec: MOD_11 Section 11
 */

import type { MetadataRoute } from "next";
import { getPublicBrandingForSlug } from "@/modules/dna-engine";
import { getPublicVehiclesForSlug } from "@/modules/inventory";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface Props {
  params: Promise<{ tenant_slug: string }>;
}

export default async function sitemap({ params }: Props): Promise<MetadataRoute.Sitemap> {
  const { tenant_slug } = await params;

  const [branding, vehicles] = await Promise.all([
    getPublicBrandingForSlug(tenant_slug),
    getPublicVehiclesForSlug(tenant_slug, { limit: 500 }),
  ]);

  if (!branding) return [];

  const base = `${SITE_URL}/${tenant_slug}`;
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/fahrzeuge`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/ueber-uns`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/kontakt`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/impressum`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/datenschutz`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const vehiclePages: MetadataRoute.Sitemap = vehicles.items.map((v) => ({
    url: `${base}/fahrzeuge/${v.id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...vehiclePages];
}
