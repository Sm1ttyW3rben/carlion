/**
 * AutoScout24 API Service Client
 *
 * Phase 1: Stub implementation.
 * Real integration requires an AutoScout24 partner contract.
 *
 * Spec: MOD_13 Section 6
 * Architecture: 01_ARCHITECTURE.md Section 8 (Service Clients)
 */

export interface AutoScout24VehicleData {
  make: string;
  model: string;
  variant?: string;
  askingPriceGross?: string;
  mileageKm?: number;
  fuelType?: string;
  firstRegistration?: string;
  description?: string;
  photoUrls?: string[];
}

export interface AutoScout24Performance {
  views: number;
  clicks: number;
  inquiries: number;
}

export interface AutoScout24Inquiry {
  externalInquiryId: string;
  externalListingId: string;
  inquirerName?: string;
  inquirerEmail?: string;
  inquirerPhone?: string;
  message?: string;
  receivedAt: string;
}

const API_BASE = process.env.AUTOSCOUT24_API_URL ?? "https://api.autoscout24.com/v1";

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
  const url = process.env.AUTOSCOUT24_API_URL;
  if (!url) return { ok: true }; // Stub

  try {
    const res = await fetch(`${API_BASE}/dealers/${encodeURIComponent(dealerId)}`, {
      headers: getHeaders(apiKey),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createListing(
  apiKey: string,
  dealerId: string,
  vehicleData: AutoScout24VehicleData
): Promise<{ externalId: string; url: string }> {
  const url = process.env.AUTOSCOUT24_API_URL;
  if (!url) {
    return { externalId: `stub-as24-${Date.now()}`, url: `https://www.autoscout24.de/angebote/stub-${Date.now()}` };
  }

  const res = await fetch(`${API_BASE}/dealers/${encodeURIComponent(dealerId)}/listings`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify(mapToAs24Format(vehicleData)),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`AutoScout24 createListing failed: HTTP ${res.status}`);

  const data = (await res.json()) as { id: string; url: string };
  return { externalId: data.id, url: data.url };
}

export async function updateListing(
  apiKey: string,
  externalId: string,
  vehicleData: AutoScout24VehicleData
): Promise<void> {
  const url = process.env.AUTOSCOUT24_API_URL;
  if (!url) return;

  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(externalId)}`, {
    method: "PUT",
    headers: getHeaders(apiKey),
    body: JSON.stringify(mapToAs24Format(vehicleData)),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`AutoScout24 updateListing failed: HTTP ${res.status}`);
}

export async function deactivateListing(apiKey: string, externalId: string): Promise<void> {
  const url = process.env.AUTOSCOUT24_API_URL;
  if (!url) return;

  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(externalId)}/deactivate`, {
    method: "POST",
    headers: getHeaders(apiKey),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`AutoScout24 deactivateListing failed: HTTP ${res.status}`);
  }
}

export async function getListingPerformance(
  apiKey: string,
  externalId: string
): Promise<AutoScout24Performance> {
  const url = process.env.AUTOSCOUT24_API_URL;
  if (!url) return { views: 0, clicks: 0, inquiries: 0 };

  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(externalId)}/statistics`, {
    headers: getHeaders(apiKey),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`AutoScout24 getListingPerformance failed: HTTP ${res.status}`);

  const data = (await res.json()) as { views?: number; clicks?: number; contacts?: number };
  return { views: data.views ?? 0, clicks: data.clicks ?? 0, inquiries: data.contacts ?? 0 };
}

export async function getInquiries(
  apiKey: string,
  dealerId: string,
  since: Date
): Promise<AutoScout24Inquiry[]> {
  const url = process.env.AUTOSCOUT24_API_URL;
  if (!url) return [];

  const res = await fetch(
    `${API_BASE}/dealers/${encodeURIComponent(dealerId)}/contacts?since=${since.toISOString()}`,
    {
      headers: getHeaders(apiKey),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!res.ok) throw new Error(`AutoScout24 getInquiries failed: HTTP ${res.status}`);

  return (await res.json()) as AutoScout24Inquiry[];
}

function mapToAs24Format(v: AutoScout24VehicleData): Record<string, unknown> {
  return {
    make: v.make,
    model: v.model,
    version: v.variant,
    price: v.askingPriceGross ? parseFloat(v.askingPriceGross) : undefined,
    mileage: v.mileageKm,
    fuelType: v.fuelType,
    firstRegistrationDate: v.firstRegistration,
    description: v.description,
    images: v.photoUrls,
  };
}
