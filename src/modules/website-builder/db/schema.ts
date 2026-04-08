import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants } from "@/server/db/schema/tenants";
import { vehicles } from "@/modules/inventory";
import { contacts } from "@/modules/crm";

// ---------------------------------------------------------------------------
// website_settings
// One per tenant. Auto-created at tenant creation (is_published = false).
// ---------------------------------------------------------------------------

export const websiteSettings = pgTable("website_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // Publication state
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  // Customizable texts
  heroHeadline: text("hero_headline"),
  heroSubheadline: text("hero_subheadline"),
  heroCtatext: text("hero_cta_text"),
  aboutText: text("about_text"),

  // Contact form
  contactFormEnabled: boolean("contact_form_enabled").notNull().default(true),
  contactFormRecipients: text("contact_form_recipients").array().notNull().default([]),

  // SEO overrides
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),

  // Google
  googleAnalyticsId: text("google_analytics_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// NOTE: SQL migration adds:
//   RLS policies (tenant isolation)

export type WebsiteSettingsRecord = typeof websiteSettings.$inferSelect;
export type NewWebsiteSettings = typeof websiteSettings.$inferInsert;

// ---------------------------------------------------------------------------
// website_contact_submissions
// Incoming submissions from the public contact form.
// Buffer before CRM processing.
// ---------------------------------------------------------------------------

export const websiteContactSubmissions = pgTable("website_contact_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // Form data
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id),

  // Processing
  processed: boolean("processed").notNull().default(false),
  contactId: uuid("contact_id").references(() => contacts.id),

  // Spam protection
  ipAddress: text("ip_address"),
  honeypot: text("honeypot"),   // Must be empty — bots fill it in

  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

// NOTE: SQL migration adds:
//   RLS policies
//   INDEX idx_submissions_tenant ON website_contact_submissions(tenant_id, submitted_at DESC)
//   INDEX idx_submissions_unprocessed ON website_contact_submissions(tenant_id) WHERE processed = false

export type WebsiteContactSubmission = typeof websiteContactSubmissions.$inferSelect;
export type NewWebsiteContactSubmission = typeof websiteContactSubmissions.$inferInsert;
