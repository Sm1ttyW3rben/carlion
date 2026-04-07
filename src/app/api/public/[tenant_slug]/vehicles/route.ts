/**
 * Public Vehicle Listing Route
 *
 * Read-only, service role, only published vehicles.
 * No auth required — this is the public-facing vehicle list for the dealership website.
 * Spec: MOD_02 Section 6
 *       01_ARCHITECTURE.md Section 10 (Public Delivery Model)
 *       Rule 11: Public data only via /api/public/ — no tRPC, no JWT required
 */

import { NextRequest, NextResponse } from "next/server";
import { getPublicVehiclesForSlug } from "@/modules/inventory/services/inventory-service";

export const revalidate = 60; // ISR: revalidate every 60s

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant_slug: string }> }
) {
  const { tenant_slug } = await params;
  const searchParams = request.nextUrl.searchParams;

  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;
  const make = searchParams.get("make") ?? undefined;
  const fuelType = searchParams.get("fuel_type") ?? undefined;
  const priceMaxParam = searchParams.get("price_max");
  const priceMax = priceMaxParam ? parseFloat(priceMaxParam) : undefined;
  const sortParam = searchParams.get("sort");
  const sort = (["price_asc", "price_desc", "newest", "mileage_asc"].includes(sortParam ?? "")
    ? sortParam
    : "newest") as "price_asc" | "price_desc" | "newest" | "mileage_asc";

  const result = await getPublicVehiclesForSlug(tenant_slug, {
    cursor,
    limit,
    make,
    fuelType,
    priceMax,
    sort,
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
