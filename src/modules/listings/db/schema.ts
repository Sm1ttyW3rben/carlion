import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "@/server/db/schema/tenants";
import { vehicles } from "@/modules/inventory";
import { contacts } from "@/modules/crm";

// ---------------------------------------------------------------------------
// listing_connections
// One per (tenant, platform). Stores API credentials (AES-256 encrypted).
// ---------------------------------------------------------------------------

export const listingConnections = pgTable("listing_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),

  platform: text("platform").notNull(),           // mobile_de | autoscout24

  // Credentials — AES-256-GCM encrypted at rest
  apiKeyEncrypted: text("api_key_encrypted"),
  dealerId: text("dealer_id"),                    // Händler-ID bei der Börse

  connectionStatus: text("connection_status").notNull().default("disconnected"),
  //                                                disconnected | connected | draining | error
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastError: text("last_error"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// NOTE: SQL migration adds:
//   UNIQUE (tenant_id, platform)
//   CHECK platform IN ('mobile_de', 'autoscout24')
//   CHECK connection_status IN ('disconnected', 'connected', 'draining', 'error')
//   RLS policies

export type ListingConnection = typeof listingConnections.$inferSelect;
export type NewListingConnection = typeof listingConnections.$inferInsert;

// ---------------------------------------------------------------------------
// listings
// One per (tenant, vehicle, platform).
// ---------------------------------------------------------------------------

export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id),

  platform: text("platform").notNull(),           // mobile_de | autoscout24

  // Remote reference
  externalId: text("external_id"),
  externalUrl: text("external_url"),

  // Sync state
  syncStatus: text("sync_status").notNull().default("pending"),
  //                                                 pending | synced | error | deactivated
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),

  // Performance counters (updated by pull-performance cron)
  viewsTotal: integer("views_total").notNull().default(0),
  clicksTotal: integer("clicks_total").notNull().default(0),
  inquiriesTotal: integer("inquiries_total").notNull().default(0),
  lastPerformanceUpdate: timestamp("last_performance_update", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// NOTE: SQL migration adds:
//   UNIQUE (tenant_id, vehicle_id, platform)
//   CHECK platform IN ('mobile_de', 'autoscout24')
//   CHECK sync_status IN ('pending', 'synced', 'error', 'deactivated')
//   RLS policies + all indexes

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

// ---------------------------------------------------------------------------
// listing_inquiries
// Incoming inquiries from the Börsen APIs (pulled by cron).
// ---------------------------------------------------------------------------

export const listingInquiries = pgTable("listing_inquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id),

  // Inquirer data
  inquirerName: text("inquirer_name"),
  inquirerEmail: text("inquirer_email"),
  inquirerPhone: text("inquirer_phone"),
  message: text("message"),

  // Processing
  processed: boolean("processed").notNull().default(false),
  contactId: uuid("contact_id").references(() => contacts.id),
  dealId: uuid("deal_id"),                         // No FK — same pattern as CRM activities
  processingNotes: text("processing_notes"),

  // Origin
  platform: text("platform").notNull(),
  externalInquiryId: text("external_inquiry_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// NOTE: SQL migration adds:
//   UNIQUE (tenant_id, platform, external_inquiry_id) WHERE external_inquiry_id IS NOT NULL
//   CHECK platform IN ('mobile_de', 'autoscout24')
//   RLS policies + indexes

export type ListingInquiry = typeof listingInquiries.$inferSelect;
export type NewListingInquiry = typeof listingInquiries.$inferInsert;

// ---------------------------------------------------------------------------
// import_sessions
// Server-side storage of parsed file-import results. Prevents client manipulation.
// ---------------------------------------------------------------------------

export const importSessions = pgTable("import_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),

  platform: text("platform").notNull(),
  status: text("status").notNull().default("pending"),
  //                                      pending | confirmed | expired

  parsedVehicles: jsonb("parsed_vehicles").notNull(),   // VehicleImportRow[]
  parseErrors: jsonb("parse_errors").notNull().default([]),
  parseWarnings: jsonb("parse_warnings").notNull().default([]),

  vehicleCount: integer("vehicle_count").notNull(),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  originalFilename: text("original_filename"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// NOTE: SQL migration adds:
//   CHECK platform IN ('mobile_de', 'autoscout24')
//   CHECK status IN ('pending', 'confirmed', 'expired')
//   RLS policies + index

export type ImportSession = typeof importSessions.$inferSelect;
export type NewImportSession = typeof importSessions.$inferInsert;
