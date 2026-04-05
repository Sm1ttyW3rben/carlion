import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const aiEventStatusEnum = pgEnum("ai_event_status", [
  "success",
  "failed",
  "pending",
  "rolled_back",
]);

export const aiEventLog = pgTable("ai_event_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  // null = System/AI autonomous action
  userId: uuid("user_id").references(() => users.id),
  module: text("module").notNull(),
  action: text("action").notNull(),
  // Anonymized summary — no PII
  summary: text("summary"),
  status: aiEventStatusEnum("status").notNull().default("pending"),
  // Snapshot for undo — encrypted (AES-256) in production
  rollbackData: jsonb("rollback_data"),
  tokenUsage: integer("token_usage"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Retention: 12 months — enforced by a scheduled cleanup job
});

export type AiEventLog = typeof aiEventLog.$inferSelect;
export type NewAiEventLog = typeof aiEventLog.$inferInsert;
