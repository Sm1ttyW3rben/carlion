import type { Listing, ListingConnection, ListingInquiry, ImportSession } from "../db/schema";
import type {
  PLATFORM_VALUES,
  SYNC_STATUS_VALUES,
  CONNECTION_STATUS_VALUES,
  IMPORT_SESSION_STATUS_VALUES,
} from "./constants";

// ---------------------------------------------------------------------------
// Re-export DB types
// ---------------------------------------------------------------------------

export type { Listing, ListingConnection, ListingInquiry, ImportSession };

// ---------------------------------------------------------------------------
// Enum types
// ---------------------------------------------------------------------------

export type Platform = (typeof PLATFORM_VALUES)[number];
export type SyncStatus = (typeof SYNC_STATUS_VALUES)[number];
export type ConnectionStatus = (typeof CONNECTION_STATUS_VALUES)[number];
export type ImportSessionStatus = (typeof IMPORT_SESSION_STATUS_VALUES)[number];

// ---------------------------------------------------------------------------
// Parser types (shared between boersen-parser.ts and import flow)
// ---------------------------------------------------------------------------

export interface VehicleImportRow {
  sourceReference: string;   // "{platform}:{external_id}" — always platform-scoped
  externalId: string;
  make: string;
  model: string;
  variant?: string;
  vin?: string;
  mileageKm?: number;
  askingPriceGross?: string;
  fuelType?: string;
  transmission?: string;
  firstRegistration?: string; // ISO date
  bodyType?: string;
  colorExterior?: string;
  equipment?: string[];
  equipmentCodes?: string[];
  unmappedFields: Record<string, string>;
}

export interface ParseError {
  row: number;
  field?: string;
  message: string;
}

export interface ParseWarning {
  row: number;
  field?: string;
  message: string;
}

export interface ParseResult {
  platform: Platform;
  vehicles: VehicleImportRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

// ---------------------------------------------------------------------------
// View types (API layer)
// ---------------------------------------------------------------------------

export interface ConnectionView {
  id: string;
  platform: Platform;
  dealerId: string | null;
  connectionStatus: ConnectionStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  listingsCount: number;        // active listings (sync_status != 'deactivated')
}

export interface ListingView {
  id: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    askingPrice: string | null;
    mainPhotoUrl: string | null;
  };
  platform: Platform;
  externalId: string | null;
  externalUrl: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  viewsTotal: number;
  clicksTotal: number;
  inquiriesTotal: number;
  createdAt: string;
}

export interface InquiryView {
  id: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    mainPhotoUrl: string | null;
  };
  platform: Platform;
  inquirerName: string | null;
  inquirerEmail: string | null;
  inquirerPhone: string | null;
  message: string | null;
  processed: boolean;
  processingNotes: string | null;
  contact: { id: string; displayName: string } | null;
  deal: { id: string; stage: string } | null;
  receivedAt: string;
}

export interface ImportSessionView {
  id: string;
  platform: Platform;
  status: ImportSessionStatus;
  preview: VehicleImportRow[];  // first 10 rows
  totalCount: number;
  duplicateCount: number;
  errors: ParseError[];
  warnings: ParseWarning[];
  createdAt: string;
  expiresAt: string;
}

export interface ListingsStats {
  totalListings: number;
  byPlatform: Record<string, number>;
  bySyncStatus: Record<string, number>;
  totalViews: number;
  totalClicks: number;
  totalInquiries: number;
  unprocessedInquiries: number;
}

// ---------------------------------------------------------------------------
// Outbox payload
// ---------------------------------------------------------------------------

export interface BoerenSyncPayload {
  listingId: string;
  vehicleId: string;
  platform: Platform;
  tenantId: string;
}
