import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

export const tenantPlanEnum = pgEnum("tenant_plan", [
  "free",
  "trial",
  "starter",
  "professional",
]);

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "trial",
  "suspended",
  "cancelled",
]);

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  // org_id: nullable — Phase 2 (Organisation-Layer)
  orgId: uuid("org_id"),
  plan: tenantPlanEnum("plan").notNull().default("trial"),
  status: tenantStatusEnum("status").notNull().default("trial"),
  // Branding aus DNA-Engine: { logoUrl, primaryColor, secondaryColor, domain }
  branding: jsonb("branding"),
  // App-Settings: { language, timezone, currency }
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
