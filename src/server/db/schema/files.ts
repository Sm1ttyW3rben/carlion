import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const fileProcessingStatusEnum = pgEnum("file_processing_status", [
  "pending",
  "processed",
  "failed",
]);

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  entityType: text("entity_type").notNull(), // vehicle | document | branding
  entityId: uuid("entity_id").notNull(),
  storagePath: text("storage_path").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  kind: text("kind").notNull(), // photo | thumbnail | contract | logo
  position: integer("position"),
  isPublic: boolean("is_public").notNull().default(false),
  // AI-generated for vehicle photos
  altText: text("alt_text"),
  processingStatus: fileProcessingStatusEnum("processing_status")
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
