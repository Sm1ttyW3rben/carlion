import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "sent",
  "failed",
]);

// Outbox pattern for async external sends (email, WhatsApp, exchange sync)
// User-triggered sends bypass outbox and go direct (outbox used only as retry fallback)
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  service: text("service").notNull(), // resend | threesixty | dat | mobile-de
  action: text("action").notNull(),   // send_email | send_whatsapp | sync_listing
  payload: jsonb("payload").notNull(),
  status: outboxStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
});

export type Outbox = typeof outbox.$inferSelect;
export type NewOutbox = typeof outbox.$inferInsert;
