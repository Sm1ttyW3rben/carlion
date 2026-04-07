import { z } from "zod";
import {
  VEHICLE_STATUS_VALUES,
  VEHICLE_TAX_TYPE_VALUES,
  VEHICLE_SOURCE_VALUES,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
} from "./constants";

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const vehicleStatusSchema = z.enum(VEHICLE_STATUS_VALUES);
export const vehicleTaxTypeSchema = z.enum(VEHICLE_TAX_TYPE_VALUES);
export const vehicleSourceSchema = z.enum(VEHICLE_SOURCE_VALUES);

export const vinSchema = z
  .string()
  .length(17, "Die Fahrgestellnummer muss genau 17 Zeichen lang sein.")
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "Ungültige Fahrgestellnummer.");

// ---------------------------------------------------------------------------
// Create — inventory.create
// ---------------------------------------------------------------------------

export const createVehicleSchema = z.object({
  // Identification
  vin: vinSchema.optional(),
  internalNumber: z.string().max(50).optional(),
  licensePlate: z.string().max(20).optional(),

  // Master data (make + model are required)
  make: z.string().min(1, "Marke ist erforderlich.").max(100),
  model: z.string().min(1, "Modell ist erforderlich.").max(100),
  variant: z.string().max(100).optional(),
  modelYear: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  firstRegistration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // ISO date

  // Technical
  bodyType: z.string().max(50).optional(),
  fuelType: z.string().max(50).optional(),
  transmission: z.string().max(50).optional(),
  driveType: z.string().max(50).optional(),
  engineSizeCcm: z.number().int().min(0).optional(),
  powerKw: z.number().int().min(0).optional(),
  powerPs: z.number().int().min(0).optional(),
  doors: z.number().int().min(0).max(10).optional(),
  seats: z.number().int().min(0).max(20).optional(),
  colorExterior: z.string().max(100).optional(),
  colorInterior: z.string().max(100).optional(),
  emissionClass: z.string().max(20).optional(),
  co2Emissions: z.number().int().min(0).optional(),
  fuelConsumption: z.object({
    combined: z.number().min(0).optional(),
    urban: z.number().min(0).optional(),
    highway: z.number().min(0).optional(),
  }).optional(),
  electricRangeKm: z.number().int().min(0).optional(),
  batteryCapacityKwh: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),

  // Condition
  mileageKm: z.number().int().min(0).optional(),
  condition: z.string().max(50).optional(),
  previousOwners: z.number().int().min(0).optional(),
  huValidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  accidentFree: z.boolean().optional(),
  nonSmoker: z.boolean().optional(),

  // Equipment
  equipment: z.array(z.string().max(200)).default([]),
  equipmentCodes: z.array(z.string().max(50)).default([]),

  // Prices
  purchasePriceNet: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  askingPriceGross: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  minimumPriceGross: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  taxType: vehicleTaxTypeSchema.default("margin"),

  // Description
  title: z.string().max(200).optional(),
  description: z.string().max(10000).optional(),
  internalNotes: z.string().max(5000).optional(),

  // Standzeit
  inStockSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Origin
  source: vehicleSourceSchema.default("manual"),
  sourceReference: z.string().max(200).optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

// ---------------------------------------------------------------------------
// Update — inventory.update
// EXCLUDED: status, published, featured, reserved_for_contact_id,
//           reserved_at, sold_at, delivered_at, tenant_id, source,
//           source_reference, created_by, created_at, deleted_at
// ---------------------------------------------------------------------------

export const updateVehicleSchema = z.object({
  id: z.string().uuid(),

  // All editable fields (same as create, minus status/lifecycle)
  vin: vinSchema.optional(),
  internalNumber: z.string().max(50).nullable().optional(),
  licensePlate: z.string().max(20).nullable().optional(),
  make: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  variant: z.string().max(100).nullable().optional(),
  modelYear: z.number().int().min(1900).nullable().optional(),
  firstRegistration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  bodyType: z.string().max(50).nullable().optional(),
  fuelType: z.string().max(50).nullable().optional(),
  transmission: z.string().max(50).nullable().optional(),
  driveType: z.string().max(50).nullable().optional(),
  engineSizeCcm: z.number().int().min(0).nullable().optional(),
  powerKw: z.number().int().min(0).nullable().optional(),
  powerPs: z.number().int().min(0).nullable().optional(),
  doors: z.number().int().min(0).max(10).nullable().optional(),
  seats: z.number().int().min(0).max(20).nullable().optional(),
  colorExterior: z.string().max(100).nullable().optional(),
  colorInterior: z.string().max(100).nullable().optional(),
  emissionClass: z.string().max(20).nullable().optional(),
  co2Emissions: z.number().int().min(0).nullable().optional(),
  fuelConsumption: z.object({
    combined: z.number().min(0).optional(),
    urban: z.number().min(0).optional(),
    highway: z.number().min(0).optional(),
  }).nullable().optional(),
  electricRangeKm: z.number().int().min(0).nullable().optional(),
  batteryCapacityKwh: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  mileageKm: z.number().int().min(0).nullable().optional(),
  condition: z.string().max(50).nullable().optional(),
  previousOwners: z.number().int().min(0).nullable().optional(),
  huValidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  accidentFree: z.boolean().nullable().optional(),
  nonSmoker: z.boolean().nullable().optional(),
  equipment: z.array(z.string().max(200)).optional(),
  equipmentCodes: z.array(z.string().max(50)).optional(),
  purchasePriceNet: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  askingPriceGross: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  minimumPriceGross: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  taxType: vehicleTaxTypeSchema.optional(),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  inStockSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  featured: z.boolean().optional(),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

// ---------------------------------------------------------------------------
// Update status — inventory.updateStatus
// ---------------------------------------------------------------------------

export const updateVehicleStatusSchema = z.object({
  id: z.string().uuid(),
  status: vehicleStatusSchema,
  reservedForContactId: z.string().uuid().optional(),
});

export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>;

// ---------------------------------------------------------------------------
// List — inventory.list
// ---------------------------------------------------------------------------

export const vehicleListInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  // Filters
  status: z.union([vehicleStatusSchema, z.array(vehicleStatusSchema)]).optional(),
  published: z.boolean().optional(),
  includeArchived: z.boolean().default(false),
  search: z.string().max(200).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  fuelType: z.string().max(50).optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  mileageMin: z.number().int().min(0).optional(),
  mileageMax: z.number().int().min(0).optional(),
  yearMin: z.number().int().min(1900).optional(),
  yearMax: z.number().int().optional(),
  daysInStockMin: z.number().int().min(0).optional(),
  daysInStockMax: z.number().int().min(0).optional(),
  // Sort
  sortBy: z.enum(["created_at", "asking_price_gross", "in_stock_since", "mileage_km", "make"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type VehicleListInput = z.infer<typeof vehicleListInputSchema>;

// ---------------------------------------------------------------------------
// Decode VIN — inventory.decodeVin
// ---------------------------------------------------------------------------

export const decodeVinSchema = z.object({
  vin: vinSchema,
});

// ---------------------------------------------------------------------------
// Generate description — inventory.generateDescription
// ---------------------------------------------------------------------------

export const generateDescriptionSchema = z.object({
  vehicleId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Reorder photos — inventory.reorderPhotos
// ---------------------------------------------------------------------------

export const reorderPhotosSchema = z.object({
  vehicleId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1),
});

// ---------------------------------------------------------------------------
// Delete photo — inventory.deletePhoto
// ---------------------------------------------------------------------------

export const deletePhotoSchema = z.object({
  vehicleId: z.string().uuid(),
  photoId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Bulk upsert (for Börsen-Hub Module 13 — internal service call only)
// ---------------------------------------------------------------------------

export const bulkUpsertVehicleItemSchema = createVehicleSchema.extend({
  sourceReference: z.string().min(1).max(200), // required for bulk upsert
  source: z.literal("boersen_import"),
});

export const bulkUpsertVehiclesSchema = z.object({
  tenantId: z.string().uuid(),
  vehicles: z.array(bulkUpsertVehicleItemSchema).min(1).max(1000),
  source: z.literal("boersen_import"),
});

export type BulkUpsertVehicleItem = z.infer<typeof bulkUpsertVehicleItemSchema>;
export type BulkUpsertVehiclesInput = z.infer<typeof bulkUpsertVehiclesSchema>;
