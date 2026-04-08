/**
 * Public Website Settings Route
 *
 * Returns website settings for a published tenant's website.
 * Service Role, read-only. HTTP 404 if not published.
 *
 * Spec: MOD_11 Section 6
 *       CLAUDE.md Rule 11 (public read via /api/public/)
 *
 * GET /api/public/[tenant_slug]/website
 * Cache-Control: public, max-age=300, stale-while-revalidate=600
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getPublicSettings } from "@/modules/website-builder";

export const revalidate = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant_slug: string }> }
) {
  const { tenant_slug } = await params;

  if (!tenant_slug || typeof tenant_slug !== "string") {
    return NextResponse.json({ error: "Ungültiger Tenant-Slug" }, { status: 400 });
  }

  const settings = await getPublicSettings(tenant_slug, db);

  if (!settings) {
    return NextResponse.json(
      { error: "Website nicht gefunden oder nicht veröffentlicht" },
      { status: 404 }
    );
  }

  return NextResponse.json(settings, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
