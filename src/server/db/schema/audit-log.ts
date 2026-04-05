import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const actorTypeEnum = pgEnum("actor_type", [
  "user",
  "ai",
  "system",
]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  // null when actor_type = system
  // user_id of the triggering user when actor_type = ai
  actorId: uuid("actor_id"),
  actorType: actorTypeEnum("actor_type").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  ipAddress: text("ip_address"),
  // Append-only — retention: 7 years (legal requirement)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
