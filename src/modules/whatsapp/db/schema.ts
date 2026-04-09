/**
 * WhatsApp module DB schema — 3 tables.
 * Spec: MOD_17 Section 3
 */

import { pgTable, text, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { tenants } from "@/server/db/schema/tenants";
import { contacts } from "@/modules/crm/db/schema";
import { files } from "@/server/db/schema/files";
import { users } from "@/server/db/schema/users";

// ---------------------------------------------------------------------------
// whatsapp_connections — one row per tenant
// ---------------------------------------------------------------------------

export const whatsappConnections = pgTable("whatsapp_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),

  // 360dialog config
  phoneNumberId: text("phone_number_id"),         // NULL after disconnect
  displayPhone: text("display_phone").notNull(),
  wabaId: text("waba_id").notNull(),

  // Status
  connectionStatus: text("connection_status").notNull().default("disconnected"),
  lastError: text("last_error"),
  webhookVerified: boolean("webhook_verified").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// whatsapp_conversations — one per (tenant, contact)
// ---------------------------------------------------------------------------

export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),

  remotePhone: text("remote_phone").notNull(),  // normalized E.164

  // Status
  status: text("status").notNull().default("active"),  // active | archived
  unreadCount: integer("unread_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastMessagePreview: text("last_message_preview"),

  // 24h reply window
  replyWindowExpires: timestamp("reply_window_expires", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// whatsapp_messages — each message in a conversation
// ---------------------------------------------------------------------------

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => whatsappConversations.id),

  // Content
  direction: text("direction").notNull(),          // inbound | outbound
  messageType: text("message_type").notNull().default("text"),
  body: text("body"),
  mediaUrl: text("media_url"),                     // 360dialog URL (temporary)
  mediaMimeType: text("media_mime_type"),
  mediaFileId: uuid("media_file_id").references(() => files.id),

  // WhatsApp reference
  externalMessageId: text("external_message_id"),

  // Outbound status
  sendStatus: text("send_status"),                 // sending|sent|delivered|read|failed
  sendError: text("send_error"),

  // CRM activity flag — prevents duplicates on retry
  activityCreated: boolean("activity_created").notNull().default(false),

  // Sender (null for inbound)
  sentBy: uuid("sent_by").references(() => users.id),

  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type WhatsAppConnection = typeof whatsappConnections.$inferSelect;
export type WhatsAppConversation = typeof whatsappConversations.$inferSelect;
export type WhatsAppMessage = typeof whatsappMessages.$inferSelect;
