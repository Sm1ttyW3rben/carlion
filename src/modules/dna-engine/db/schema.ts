import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { tenants } from "@/server/db/schema/tenants";
import { files } from "@/server/db/schema/files";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const brandingToneEnum = pgEnum("branding_tone", [
  "professional",
  "friendly",
  "premium",
  "casual",
]);

export const brandingFormalityEnum = pgEnum("branding_formality", [
  "du",
  "sie",
]);

export const dealershipTypeEnum = pgEnum("dealership_type", [
  "einzelhaendler",
  "autohaus",
  "mehrmarkenhaendler",
  "premiumhaendler",
]);

export const descriptionStyleEnum = pgEnum("description_style", [
  "factual",
  "emotional",
  "balanced",
]);

export const fontHeadingEnum = pgEnum("font_heading", [
  "Inter",
  "Nunito",
  "Playfair Display",
  "Poppins",
]);

export const fontBodyEnum = pgEnum("font_body", [
  "Inter",
  "Open Sans",
  "Lato",
  "Nunito Sans",
]);

export const borderRadiusEnum = pgEnum("border_radius_style", [
  "none",
  "sm",
  "md",
  "lg",
  "full",
]);

export const buttonStyleEnum = pgEnum("button_style", [
  "solid",
  "outline",
  "ghost",
]);

export const brandingCompletenessEnum = pgEnum("branding_completeness", [
  "draft",
  "branding_complete",
  "publish_ready",
]);

export const crawlStatusEnum = pgEnum("crawl_status", [
  "pending",
  "crawling",
  "analyzing",
  "completed",
  "failed",
]);

// ---------------------------------------------------------------------------
// tenant_branding
// One record per tenant. Created by Platform Foundation at registration (draft).
// DNA-Engine refines it.
// ---------------------------------------------------------------------------

export const tenantBranding = pgTable("tenant_branding", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: "cascade" }),

  // --- Visual Identity ---
  // logo_file_id and favicon_file_id reference the files table.
  // No direct URLs — all assets go through the Asset Pipeline (see Section 5.5).
  logoFileId: uuid("logo_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  faviconFileId: uuid("favicon_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  primaryColor: text("primary_color").notNull().default("#2563EB"),
  secondaryColor: text("secondary_color").notNull().default("#1E40AF"),
  accentColor: text("accent_color"),
  backgroundColor: text("background_color").notNull().default("#FFFFFF"),
  textColor: text("text_color").notNull().default("#1A1A1A"),
  // Generated from primary/secondary; never written by client directly
  colorPalette: jsonb("color_palette").notNull().default({}),
  fontHeading: fontHeadingEnum("font_heading").notNull().default("Inter"),
  fontBody: fontBodyEnum("font_body").notNull().default("Inter"),
  borderRadius: borderRadiusEnum("border_radius").notNull().default("md"),
  buttonStyle: buttonStyleEnum("button_style").notNull().default("solid"),

  // --- Communication Identity ---
  // No dealership_name — canonical name lives in tenants.name (see Section 3.1)
  tone: brandingToneEnum("tone").notNull().default("professional"),
  formality: brandingFormalityEnum("formality").notNull().default("sie"),
  dealershipType: dealershipTypeEnum("dealership_type")
    .notNull()
    .default("einzelhaendler"),
  tagline: text("tagline"),
  welcomeMessage: text("welcome_message"),
  emailSignature: text("email_signature"),
  descriptionStyle: descriptionStyleEnum("description_style")
    .notNull()
    .default("balanced"),

  // --- Business Data ---
  address: jsonb("address"), // { street, zip, city }
  phone: text("phone"),
  email: text("email"),
  openingHours: jsonb("opening_hours"), // Record<weekday, { open, close, closed }>
  websiteUrl: text("website_url"),
  googleMapsUrl: text("google_maps_url"),
  imprintData: jsonb("imprint_data"), // { managing_director, hrb, ust_id, court }

  // --- Completeness (recalculated by service on every mutation) ---
  completeness: brandingCompletenessEnum("completeness")
    .notNull()
    .default("draft"),

  // --- Meta ---
  onboardingSource: text("onboarding_source"), // URL that was crawled
  generationLog: jsonb("generation_log"), // what was AI-generated vs manual vs default

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TenantBrandingRecord = typeof tenantBranding.$inferSelect;
export type NewTenantBranding = typeof tenantBranding.$inferInsert;

// ---------------------------------------------------------------------------
// dna_crawl_results
// Stores one record per crawl attempt for auditability.
// The partial unique index (one active crawl per tenant) is in the SQL migration —
// Drizzle does not support WHERE clauses in uniqueIndex().
// ---------------------------------------------------------------------------

export const dnaCrawlResults = pgTable("dna_crawl_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  status: crawlStatusEnum("status").notNull().default("pending"),

  // Raw HTML is stored for debugging; nulled after 30 days by cron
  rawHtml: text("raw_html"),

  // Extracted structured data from HTML parsing
  extractedData: jsonb("extracted_data"),
  // {
  //   logo_candidates: [{ url, context }],
  //   colors_found: [{ hex, frequency, context }],
  //   texts: { tagline, about, meta_description },
  //   contact: { phone, email, address },
  //   opening_hours: [...],
  // }

  // AI analysis results
  aiAnalysis: jsonb("ai_analysis"),
  // {
  //   suggested_tone, suggested_formality, suggested_type,
  //   secondary_color, accent_color, font_heading, font_body,
  //   tagline, welcome_message, confidence: { tone, formality, type }
  // }

  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DnaCrawlResultRecord = typeof dnaCrawlResults.$inferSelect;
export type NewDnaCrawlResult = typeof dnaCrawlResults.$inferInsert;
