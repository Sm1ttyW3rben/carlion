/**
 * webhook_log — append-only log of all incoming webhooks.
 *
 * Architecture: Signatur validieren → INSERT → HTTP 200 → verarbeiten.
 * processed = false entries are retried by cron jobs.
 */

import { pgTable, text, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";

export const webhookLog = pgTable("webhook_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  // External event ID for deduplication (e.g. 360dialog message ID)
  eventId: text("event_id"),
  // Source service: threesixty | stripe | etc.
  service: text("service").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookLog = typeof webhookLog.$inferSelect;
export type NewWebhookLog = typeof webhookLog.$inferInsert;
