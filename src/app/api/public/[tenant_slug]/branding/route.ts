/**
 * Public Branding Route Handler
 *
 * Delivers the tenant's branding data to public consumers (Website Builder, etc.).
 * No auth required — service role, read-only.
 * Only responds if completeness === 'publish_ready'.
 *
 * Spec: MOD_34 Section 8
 *
 * GET /api/public/[tenant_slug]/branding
 * Cache-Control: public, max-age=300, stale-while-revalidate=600
 */

import { NextRequest, NextResponse } from "next/server";
import { getPublicBrandingForSlug } from "@/modules/dna-engine/services/dna-service";

// Vercel ISR revalidation period (seconds)
export const revalidate = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant_slug: string }> }
): Promise<NextResponse> {
  const { tenant_slug } = await params;

  if (!tenant_slug || typeof tenant_slug !== "string") {
    return NextResponse.json({ error: "Ungültiger Tenant-Slug" }, { status: 400 });
  }

  const branding = await getPublicBrandingForSlug(tenant_slug);

  if (!branding) {
    // Returns 404 for: tenant not found, not active/trial, or not publish_ready.
    // This prevents unfinished branding from being publicly visible.
    return NextResponse.json(
      { error: "Branding nicht gefunden oder noch nicht veröffentlicht" },
      { status: 404 }
    );
  }

  return NextResponse.json(branding, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
