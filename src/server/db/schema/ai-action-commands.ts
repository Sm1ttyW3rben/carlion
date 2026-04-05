import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const aiActionStatusEnum = pgEnum("ai_action_status", [
  "proposed",
  "confirmed",
  "executed",
  "rolled_back",
  "expired",
  "cancelled",
]);

// Tracks the Propose → Preview → Confirm → Execute → Undo lifecycle
export const aiActionCommands = pgTable("ai_action_commands", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  // Reference to the chat message that triggered this action
  assistantMessageId: uuid("assistant_message_id"),
  actionType: text("action_type").notNull(),
  targetModule: text("target_module").notNull(),
  // What would change — shown in Preview step
  proposedChanges: jsonb("proposed_changes"),
  // One-time token, valid for 5 minutes
  confirmToken: text("confirm_token").unique(),
  confirmExpires: timestamp("confirm_expires", { withTimezone: true }),
  status: aiActionStatusEnum("status").notNull().default("proposed"),
  // Snapshot BEFORE execution — encrypted in production
  rollbackData: jsonb("rollback_data"),
  // Side effects that may not be fully reversible
  externalEffects: jsonb("external_effects"),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Retention: 30 days
});

export type AiActionCommand = typeof aiActionCommands.$inferSelect;
export type NewAiActionCommand = typeof aiActionCommands.$inferInsert;
