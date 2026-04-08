import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  numeric,
  integer,
} from "drizzle-orm/pg-core";
import { tenants } from "@/server/db/schema/tenants";
import { users } from "@/server/db/schema/users";
import { contacts } from "@/modules/crm";
import { vehicles } from "@/modules/inventory";

// ---------------------------------------------------------------------------
// deals
// ---------------------------------------------------------------------------

export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),

  // --- Core references ---
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id),
  vehicleId: uuid("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  assignedTo: uuid("assigned_to").references(() => users.id),

  // --- Pipeline ---
  stage: text("stage").notNull().default("inquiry"),
  stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),

  // --- Conditions ---
  offeredPrice: numeric("offered_price", { precision: 10, scale: 2 }),
  finalPrice: numeric("final_price", { precision: 10, scale: 2 }),
  tradeInVehicle: text("trade_in_vehicle"),
  tradeInValue: numeric("trade_in_value", { precision: 10, scale: 2 }),
  financingRequested: boolean("financing_requested").notNull().default(false),
  financingNotes: text("financing_notes"),

  // --- Result ---
  wonAt: timestamp("won_at", { withTimezone: true }),
  lostAt: timestamp("lost_at", { withTimezone: true }),
  lostReason: text("lost_reason"),

  // --- Notes ---
  internalNotes: text("internal_notes"),

  // --- Priority ---
  priority: text("priority").notNull().default("normal"),

  // --- Meta ---
  source: text("source").notNull().default("manual"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// NOTE: SQL migration adds CHECK constraints, RLS, indexes, partial unique index

export type DealRecord = typeof deals.$inferSelect;
export type NewDeal = typeof deals.$inferInsert;

// ---------------------------------------------------------------------------
// deal_stage_history
// ---------------------------------------------------------------------------

export const dealStageHistory = pgTable("deal_stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  durationInStageHours: integer("duration_in_stage_hours"),
  notes: text("notes"),
});

export type DealStageHistoryRecord = typeof dealStageHistory.$inferSelect;
export type NewDealStageHistory = typeof dealStageHistory.$inferInsert;
