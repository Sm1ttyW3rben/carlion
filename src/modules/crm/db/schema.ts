import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants } from "@/server/db/schema/tenants";
import { users } from "@/server/db/schema/users";
import { vehicles } from "@/modules/inventory";

// ---------------------------------------------------------------------------
// contacts
// ---------------------------------------------------------------------------

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),

  // --- Identity ---
  salutation: text("salutation"),                    // Herr, Frau, Divers, Firma
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),                 // for company contacts / partners

  // --- Contact channels ---
  email: text("email"),
  phone: text("phone"),                              // main number
  phoneMobile: text("phone_mobile"),
  whatsappNumber: text("whatsapp_number"),

  // --- Address ---
  street: text("street"),
  zipCode: text("zip_code"),
  city: text("city"),
  country: text("country").notNull().default("DE"),

  // --- Classification ---
  contactType: text("contact_type").notNull().default("prospect"),
  source: text("source").notNull().default("manual"),
  tags: text("tags").array().notNull().default([]),

  // --- Assignment ---
  assignedTo: uuid("assigned_to").references(() => users.id),

  // --- Communication preferences ---
  preferredChannel: text("preferred_channel"),        // whatsapp, email, phone, sms
  language: text("language").notNull().default("de"),

  // --- Notes & context ---
  notes: text("notes"),

  // --- GDPR ---
  gdprConsentAt: timestamp("gdpr_consent_at", { withTimezone: true }),
  gdprConsentSource: text("gdpr_consent_source"),    // form, verbal, import, website
  marketingConsent: boolean("marketing_consent").notNull().default(false),

  // --- Interaction (no is_active — computed from last_interaction_at) ---
  lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),

  // --- Meta ---
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// NOTE: The following are enforced via SQL migration (not expressible in Drizzle):
//   CHECK (last_name IS NOT NULL OR company_name IS NOT NULL)
//   CHECK contact_type IN ('customer', 'prospect', 'seller', 'partner', 'other')
//   CHECK source IN ('manual', 'csv_import', 'whatsapp', 'mobile_de', 'autoscout24',
//                    'website', 'phone', 'walk_in', 'referral', 'meta_ads')
//   RLS policies (tenant isolation)
//   All indexes per spec

export type ContactRecord = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;

// ---------------------------------------------------------------------------
// contact_vehicle_interests
// ---------------------------------------------------------------------------

export const contactVehicleInterests = pgTable("contact_vehicle_interests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  interestType: text("interest_type").notNull().default("inquiry"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// NOTE: SQL migration adds:
//   UNIQUE (tenant_id, contact_id, vehicle_id)
//   CHECK interest_type IN ('inquiry', 'test_drive', 'offer_requested', 'general')
//   RLS policies

export type ContactVehicleInterestRecord = typeof contactVehicleInterests.$inferSelect;
export type NewContactVehicleInterest = typeof contactVehicleInterests.$inferInsert;

// ---------------------------------------------------------------------------
// contact_activities
// ---------------------------------------------------------------------------

export const contactActivities = pgTable("contact_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id),

  // --- Activity data ---
  activityType: text("activity_type").notNull(),
  title: text("title"),
  description: text("description"),

  // --- References (optional) ---
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),
  dealId: uuid("deal_id"),                           // no FK yet — added by Module 03
  messageId: uuid("message_id"),                     // reference to WhatsApp/Email message

  // --- Who & When ---
  performedBy: uuid("performed_by").references(() => users.id),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// NOTE: SQL migration adds:
//   CHECK activity_type IN ('note', 'call', 'email_in', 'email_out', ...)
//   RLS policies
//   Indexes

export type ContactActivityRecord = typeof contactActivities.$inferSelect;
export type NewContactActivity = typeof contactActivities.$inferInsert;
