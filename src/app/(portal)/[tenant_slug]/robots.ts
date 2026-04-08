/**
 * robots.txt for the public dealer website.
 * Spec: MOD_11 Section 11
 */

import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface Props {
  params: Promise<{ tenant_slug: string }>;
}

export default async function robots({ params }: Props): Promise<MetadataRoute.Robots> {
  const { tenant_slug } = await params;

  return {
    rules: {
      userAgent: "*",
      allow: `/${tenant_slug}/`,
      disallow: [],
    },
    sitemap: `${SITE_URL}/${tenant_slug}/sitemap.xml`,
  };
}
