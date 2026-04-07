/**
 * Public Vehicle Detail Route
 *
 * Returns a single published vehicle for the dealership's public website.
 * Service role — no auth required.
 * Spec: MOD_02 Section 6
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/shared/lib/supabase/server";

export const revalidate = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant_slug: string; id: string }> }
) {
  const { tenant_slug, id } = await params;

  const supabase = createSupabaseServiceClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Resolve tenant by slug
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenant_slug)
    .in("status", ["active", "trial"])
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Händler nicht gefunden." }, { status: 404 });
  }

  // Fetch vehicle — only published, non-deleted
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenant.id as string)
    .eq("published", true)
    .is("deleted_at", null)
    .single();

  if (!vehicle) {
    return NextResponse.json({ error: "Fahrzeug nicht gefunden." }, { status: 404 });
  }

  // Fetch photos
  const { data: photoFiles } = await supabase
    .from("files")
    .select("storage_path, alt_text, position, kind")
    .eq("entity_type", "vehicle")
    .eq("entity_id", id)
    .is("deleted_at", null)
    .in("kind", ["photo", "thumbnail_detail"])
    .order("position", { ascending: true });

  const photos = (photoFiles ?? []).map((f: { storage_path: string; alt_text: string | null; position: number; kind: string }) => ({
    url: `${supabaseUrl}/storage/v1/object/public/${f.storage_path}`,
    altText: f.alt_text ?? null,
    position: f.position ?? 0,
  }));

  // Build PublicVehicle — NEVER include internal/sensitive fields
  const publicVehicle = {
    id: vehicle.id as string,
    make: vehicle.make as string,
    model: vehicle.model as string,
    variant: (vehicle.variant as string | null) ?? null,
    firstRegistration: (vehicle.first_registration as string | null) ?? null,
    mileageKm: (vehicle.mileage_km as number | null) ?? null,
    fuelType: (vehicle.fuel_type as string | null) ?? null,
    transmission: (vehicle.transmission as string | null) ?? null,
    powerKw: (vehicle.power_kw as number | null) ?? null,
    powerPs: (vehicle.power_ps as number | null) ?? null,
    colorExterior: (vehicle.color_exterior as string | null) ?? null,
    bodyType: (vehicle.body_type as string | null) ?? null,
    condition: (vehicle.condition as string | null) ?? null,
    askingPriceGross: (vehicle.asking_price_gross as string | null) ?? null,
    taxType: (vehicle.tax_type as string) ?? "margin",
    title: (vehicle.title as string | null) ?? null,
    description: (vehicle.description as string | null) ?? null,
    equipment: (vehicle.equipment as string[]) ?? [],
    huValidUntil: (vehicle.hu_valid_until as string | null) ?? null,
    accidentFree: (vehicle.accident_free as boolean | null) ?? null,
    photos,
    featured: (vehicle.featured as boolean) ?? false,
  };

  return NextResponse.json(publicVehicle, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
