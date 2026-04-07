import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  date,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "@/server/db/schema/tenants";
import { users } from "@/server/db/schema/users";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "draft",
  "in_preparation",
  "available",
  "reserved",
  "sold",
  "delivered",
  "archived",
]);

export const vehicleTaxTypeEnum = pgEnum("vehicle_tax_type", [
  "margin",   // Differenzbesteuerung §25a UStG (default — 80%+ of used cars)
  "regular",  // Regelbesteuerung 19% MwSt
]);

export const vehicleSourceEnum = pgEnum("vehicle_source", [
  "manual",
  "boersen_import",
  "trade_in",
  "purchase",
]);

// ---------------------------------------------------------------------------
// vehicles
// ---------------------------------------------------------------------------

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),

  // --- Identification ---
  vin: text("vin"),                            // 17 chars — enforced via DB CHECK
  internalNumber: text("internal_number"),
  licensePlate: text("license_plate"),

  // --- Master data (from VIN decode or manual) ---
  make: text("make").notNull(),
  model: text("model").notNull(),
  variant: text("variant"),
  modelYear: integer("model_year"),
  firstRegistration: date("first_registration"),

  // --- Technical data ---
  bodyType: text("body_type"),
  fuelType: text("fuel_type"),
  transmission: text("transmission"),
  driveType: text("drive_type"),
  engineSizeCcm: integer("engine_size_ccm"),
  powerKw: integer("power_kw"),
  // Stored separately — DAT delivers both; manual: service calculates when only one given
  powerPs: integer("power_ps"),
  doors: integer("doors"),
  seats: integer("seats"),
  colorExterior: text("color_exterior"),
  colorInterior: text("color_interior"),
  emissionClass: text("emission_class"),
  co2Emissions: integer("co2_emissions"),             // g/km
  fuelConsumption: jsonb("fuel_consumption"),          // { combined, urban, highway } l/100km
  electricRangeKm: integer("electric_range_km"),
  batteryCapacityKwh: numeric("battery_capacity_kwh", { precision: 5, scale: 2 }),

  // --- Condition ---
  mileageKm: integer("mileage_km"),
  condition: text("condition"),                        // Neuwagen | Jahreswagen | Gebrauchtwagen | Vorführwagen
  previousOwners: integer("previous_owners"),
  huValidUntil: date("hu_valid_until"),
  accidentFree: boolean("accident_free"),
  nonSmoker: boolean("non_smoker"),

  // --- Equipment ---
  equipment: text("equipment").array().notNull().default([]),
  equipmentCodes: text("equipment_codes").array().notNull().default([]),

  // --- Prices & Costs ---
  purchasePriceNet: numeric("purchase_price_net", { precision: 10, scale: 2 }),
  askingPriceGross: numeric("asking_price_gross", { precision: 10, scale: 2 }),
  minimumPriceGross: numeric("minimum_price_gross", { precision: 10, scale: 2 }),
  taxType: vehicleTaxTypeEnum("tax_type").notNull().default("margin"),

  // --- Description ---
  title: text("title"),
  description: text("description"),
  internalNotes: text("internal_notes"),

  // --- Status & Lifecycle ---
  status: vehicleStatusEnum("status").notNull().default("draft"),
  published: boolean("published").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  reservedForContactId: uuid("reserved_for_contact_id"),     // FK → contacts (module 01, added later)
  reservedAt: timestamp("reserved_at", { withTimezone: true }),
  soldAt: timestamp("sold_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),

  // --- Standzeit ---
  // days_in_stock is NOT stored — calculated at query time via (current_date - in_stock_since)
  inStockSince: date("in_stock_since"),

  // --- Origin ---
  source: vehicleSourceEnum("source").notNull().default("manual"),
  sourceReference: text("source_reference"),               // e.g. mobile.de listing ID

  // --- Meta ---
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// NOTE: The following are enforced via SQL migration (not expressible in Drizzle):
//   CHECK vin IS NULL OR length(vin) = 17
//   CHECK asking_price_gross IS NULL OR asking_price_gross >= 0
//   CHECK mileage_km IS NULL OR mileage_km >= 0
//   CHECK NOT (published = true AND status NOT IN ('available', 'reserved'))
//   RLS policies (tenant isolation)
//   Indexes (partial unique index for import idempotency)

export type VehicleRecord = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
