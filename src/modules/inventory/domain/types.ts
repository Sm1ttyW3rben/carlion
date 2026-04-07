import type { VehicleRecord } from "../db/schema";
import type {
  VEHICLE_STATUS_VALUES,
  VEHICLE_TAX_TYPE_VALUES,
  VEHICLE_SOURCE_VALUES,
} from "./constants";

// ---------------------------------------------------------------------------
// Re-export DB type
// ---------------------------------------------------------------------------

export type { VehicleRecord };

// ---------------------------------------------------------------------------
// Enum types
// ---------------------------------------------------------------------------

export type VehicleStatus = (typeof VEHICLE_STATUS_VALUES)[number];
export type VehicleTaxType = (typeof VEHICLE_TAX_TYPE_VALUES)[number];
export type VehicleSource = (typeof VEHICLE_SOURCE_VALUES)[number];

// ---------------------------------------------------------------------------
// Sub-types for jsonb fields
// ---------------------------------------------------------------------------

export interface FuelConsumption {
  combined?: number;  // l/100km
  urban?: number;
  highway?: number;
}

// ---------------------------------------------------------------------------
// Photo / file reference (resolved URLs — never raw file IDs)
// ---------------------------------------------------------------------------

export interface FileReference {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  kind: "photo" | "thumbnail_list" | "thumbnail_detail";
  width: number | null;
  height: number | null;
}

// ---------------------------------------------------------------------------
// VehicleView — full view for roles with price access (owner, admin, manager)
// ---------------------------------------------------------------------------

export interface VehicleView {
  id: string;
  tenantId: string;

  // Identification
  vin: string | null;
  internalNumber: string | null;
  licensePlate: string | null;

  // Master data
  make: string;
  model: string;
  variant: string | null;
  modelYear: number | null;
  firstRegistration: string | null;  // ISO date

  // Technical
  bodyType: string | null;
  fuelType: string | null;
  transmission: string | null;
  driveType: string | null;
  engineSizeCcm: number | null;
  powerKw: number | null;
  powerPs: number | null;
  doors: number | null;
  seats: number | null;
  colorExterior: string | null;
  colorInterior: string | null;
  emissionClass: string | null;
  co2Emissions: number | null;
  fuelConsumption: FuelConsumption | null;
  electricRangeKm: number | null;
  batteryCapacityKwh: string | null;

  // Condition
  mileageKm: number | null;
  condition: string | null;
  previousOwners: number | null;
  huValidUntil: string | null;
  accidentFree: boolean | null;
  nonSmoker: boolean | null;

  // Equipment
  equipment: string[];
  equipmentCodes: string[];

  // Prices — visible to owner/admin/manager only
  purchasePriceNet: string | null;
  askingPriceGross: string | null;
  minimumPriceGross: string | null;
  taxType: VehicleTaxType;
  margin: string | null;  // calculated: asking_gross - purchase_net (tax-adjusted)

  // Description
  title: string | null;
  description: string | null;
  internalNotes: string | null;

  // Status & lifecycle
  status: VehicleStatus;
  published: boolean;
  featured: boolean;
  reservedForContactId: string | null;
  reservedAt: string | null;
  soldAt: string | null;
  deliveredAt: string | null;

  // Standzeit — query-time calculated
  inStockSince: string | null;
  daysInStock: number | null;

  // Origin
  source: VehicleSource;
  sourceReference: string | null;

  // Photos
  photos: FileReference[];

  // Meta
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// VehicleViewRestricted — without purchase price, minimum price, and margin
// for salesperson, receptionist, viewer
// ---------------------------------------------------------------------------

export type VehicleViewRestricted = Omit<
  VehicleView,
  "purchasePriceNet" | "minimumPriceGross" | "margin" | "internalNotes"
>;

// ---------------------------------------------------------------------------
// VehicleListItem — compact view for list/grid
// ---------------------------------------------------------------------------

export interface VehicleListItem {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  askingPriceGross: string | null;
  taxType: VehicleTaxType;
  status: VehicleStatus;
  published: boolean;
  featured: boolean;
  daysInStock: number | null;
  inStockSince: string | null;
  mileageKm: number | null;
  fuelType: string | null;
  firstRegistration: string | null;
  bodyType: string | null;
  colorExterior: string | null;
  mainPhotoUrl: string | null;  // Position 1 thumbnail
  createdAt: string;
}

// ---------------------------------------------------------------------------
// PublicVehicle — reduced DTO for public API (no sensitive fields)
// ---------------------------------------------------------------------------

export interface PublicVehicle {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  firstRegistration: string | null;
  mileageKm: number | null;
  fuelType: string | null;
  transmission: string | null;
  powerKw: number | null;
  powerPs: number | null;
  colorExterior: string | null;
  bodyType: string | null;
  condition: string | null;
  askingPriceGross: string | null;
  taxType: string;          // for MwSt display
  title: string | null;
  description: string | null;
  equipment: string[];
  huValidUntil: string | null;
  accidentFree: boolean | null;
  photos: { url: string; altText: string | null; position: number }[];
  featured: boolean;
  // No status — publicly all visible vehicles are "available"
}

// ---------------------------------------------------------------------------
// InventoryStats — dashboard KPIs
// ---------------------------------------------------------------------------

export interface InventoryStats {
  total: number;
  byStatus: Record<VehicleStatus, number>;
  avgDaysInStock: number;
  avgAskingPrice: number;
  totalStockValue: number;
  langsteherCount: number;  // Standzeit > 90 days
}

// ---------------------------------------------------------------------------
// VinDecodingResult — from DAT service (re-exported for consumers)
// ---------------------------------------------------------------------------

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
  fuelConsumption?: FuelConsumption;
  equipmentCodes?: string[];
}

// ---------------------------------------------------------------------------
// Bulk upsert (for Börsen-Hub Module 13)
// ---------------------------------------------------------------------------

export interface ImportError {
  sourceReference: string;
  message: string;
}

export interface BulkUpsertResult {
  created: number;
  updated: number;
  errors: ImportError[];
}
