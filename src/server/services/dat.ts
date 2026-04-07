/**
 * DAT API Service Client — VIN Decoding
 *
 * Phase 1: Stub implementation.
 * Real DAT API integration requires a partner contract.
 * Without a contract: returns null (fallback = manual entry).
 *
 * Architecture: per spec 01_ARCHITECTURE.md Section 8
 * - If DAT unreachable: vehicle can be created manually, VIN decode retried via Outbox
 * - Results are cached per VIN for 30 days
 */

// In-memory cache for dev. In production this should be Redis or a DB table.
const vinCache = new Map<string, { result: VinDecodingResult; expiresAt: Date }>();

export interface VinDecodingResult {
  make?: string;
  model?: string;
  variant?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: string;
  driveType?: string;
  engineSizeCcm?: number;
  powerKw?: number;
  powerPs?: number;
  doors?: number;
  seats?: number;
  emissionClass?: string;
  co2Emissions?: number;
  fuelConsumption?: {
    combined?: number;
    urban?: number;
    highway?: number;
  };
  equipmentCodes?: string[];
}

/**
 * Decodes a VIN via the DAT API.
 * Returns null if DAT is not configured or unreachable.
 * Result is cached per VIN for 30 days.
 */
export async function decodeVin(vin: string): Promise<VinDecodingResult | null> {
  if (!vin || vin.length !== 17) return null;

  const apiKey = process.env.DAT_API_KEY;
  const apiUrl = process.env.DAT_API_URL;

  // Check cache first
  const cached = vinCache.get(vin);
  if (cached && cached.expiresAt > new Date()) {
    return cached.result;
  }

  // No DAT credentials configured → return null (manual entry)
  if (!apiKey || !apiUrl) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const response = await fetch(`${apiUrl}/decode/${encodeURIComponent(vin)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    const result = mapDatResponse(data);

    // Cache for 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    vinCache.set(vin, { result, expiresAt });

    return result;
  } catch {
    // DAT unreachable or timed out — return null, caller handles via Outbox
    return null;
  }
}

/**
 * Maps DAT API response fields to our internal VinDecodingResult.
 * Adjust field names when real DAT API contract is available.
 */
function mapDatResponse(data: Record<string, unknown>): VinDecodingResult {
  return {
    make: data.make as string | undefined,
    model: data.model as string | undefined,
    variant: data.variant as string | undefined,
    bodyType: data.bodyType as string | undefined,
    fuelType: data.fuelType as string | undefined,
    transmission: data.transmission as string | undefined,
    driveType: data.driveType as string | undefined,
    engineSizeCcm: data.engineSizeCcm as number | undefined,
    powerKw: data.powerKw as number | undefined,
    powerPs: data.powerPs as number | undefined,
    doors: data.doors as number | undefined,
    seats: data.seats as number | undefined,
    emissionClass: data.emissionClass as string | undefined,
    co2Emissions: data.co2Emissions as number | undefined,
    fuelConsumption: data.fuelConsumption as VinDecodingResult["fuelConsumption"],
    equipmentCodes: data.equipmentCodes as string[] | undefined,
  };
}
