/**
 * mobile.de API Service Client
 *
 * Phase 1: Stub implementation.
 * Real integration requires a mobile.de partner contract.
 * Without a contract: all methods return stub responses or throw.
 *
 * Spec: MOD_13 Section 6
 * Architecture: 01_ARCHITECTURE.md Section 8 (Service Clients)
 */

export interface MobileDeVehicleData {
  make: string;
  model: string;
  variant?: string;
  askingPriceGross?: string;
  mileageKm?: number;
  fuelType?: string;
  firstRegistration?: string;
  description?: string;
  photoUrls?: string[];
  externalId?: string; // for updates
}

export interface MobileDePerformance {
  views: number;
  clicks: number;
  inquiries: number;
}

export interface MobileDeInquiry {
  externalInquiryId: string;
  externalListingId: string;
  inquirerName?: string;
  inquirerEmail?: string;
  inquirerPhone?: string;
  message?: string;
  receivedAt: string; // ISO timestamp
}

const API_BASE = process.env.MOBILE_DE_API_URL ?? "https://api.mobile.de/v1";

function getHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function testConnection(
  apiKey: string,
  dealerId: string
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.MOBILE_DE_API_URL;
  if (!url) {
    // Not configured — stub returns ok for dev
    return { ok: true };
  }

  try {
    const res = await fetch(`${API_BASE}/dealers/${encodeURIComponent(dealerId)}`, {
      headers: getHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createListing(
  apiKey: string,
  dealerId: string,
  vehicleData: MobileDeVehicleData
): Promise<{ externalId: string; url: string }> {
  const url = process.env.MOBILE_DE_API_URL;
  if (!url) {
    // Stub for dev — return fake ID
    return { externalId: `stub-${Date.now()}`, url: `https://www.mobile.de/auto/stub-${Date.now()}` };
  }

  const res = await fetch(`${API_BASE}/dealers/${encodeURIComponent(dealerId)}/listings`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify(mapToMobileDeFormat(vehicleData)),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`mobile.de createListing failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { id: string; url: string };
  return { externalId: data.id, url: data.url };
}

export async function updateListing(
  apiKey: string,
  externalId: string,
  vehicleData: MobileDeVehicleData
): Promise<void> {
  const url = process.env.MOBILE_DE_API_URL;
  if (!url) return; // Stub

  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(externalId)}`, {
    method: "PUT",
    headers: getHeaders(apiKey),
    body: JSON.stringify(mapToMobileDeFormat(vehicleData)),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`mobile.de updateListing failed: HTTP ${res.status}`);
  }
}

export async function deactivateListing(
  apiKey: string,
  externalId: string
): Promise<void> {
  const url = process.env.MOBILE_DE_API_URL;
  if (!url) return; // Stub

  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(externalId)}/deactivate`, {
    method: "POST",
    headers: getHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`mobile.de deactivateListing failed: HTTP ${res.status}`);
  }
}

export async function getListingPerformance(
  apiKey: string,
  externalId: string
): Promise<MobileDePerformance> {
  const url = process.env.MOBILE_DE_API_URL;
  if (!url) return { views: 0, clicks: 0, inquiries: 0 }; // Stub

  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(externalId)}/performance`, {
    headers: getHeaders(apiKey),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`mobile.de getListingPerformance failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { views?: number; clicks?: number; inquiries?: number };
  return {
    views: data.views ?? 0,
    clicks: data.clicks ?? 0,
    inquiries: data.inquiries ?? 0,
  };
}

export async function getInquiries(
  apiKey: string,
  dealerId: string,
  since: Date
): Promise<MobileDeInquiry[]> {
  const url = process.env.MOBILE_DE_API_URL;
  if (!url) return []; // Stub

  const res = await fetch(
    `${API_BASE}/dealers/${encodeURIComponent(dealerId)}/inquiries?since=${since.toISOString()}`,
    {
      headers: getHeaders(apiKey),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!res.ok) {
    throw new Error(`mobile.de getInquiries failed: HTTP ${res.status}`);
  }

  return (await res.json()) as MobileDeInquiry[];
}

function mapToMobileDeFormat(v: MobileDeVehicleData): Record<string, unknown> {
  return {
    make: v.make,
    model: v.model,
    variant: v.variant,
    price: v.askingPriceGross ? parseFloat(v.askingPriceGross) : undefined,
    mileage: v.mileageKm,
    fuelType: v.fuelType,
    firstRegistration: v.firstRegistration,
    description: v.description,
    photos: v.photoUrls,
  };
}
