/**
 * WhatsApp Service — all business logic.
 *
 * tRPC router is a thin orchestration layer.
 * Webhook processing and outbound flow live here.
 * Spec: MOD_17
 */

import { eq, and, desc, or, ilike, sql, isNull, inArray, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "@/server/trpc/context";
import { whatsappConnections, whatsappConversations, whatsappMessages } from "../db/schema";
import type { WhatsAppConnection, WhatsAppConversation, WhatsAppMessage } from "../db/schema";
import { contacts } from "@/modules/crm";
import { users } from "@/server/db/schema/users";
import { outbox } from "@/server/db/schema/outbox";
import { webhookLog } from "@/server/db/schema/webhook-log";
import { auditLog } from "@/server/db/schema/audit-log";
import { files } from "@/server/db/schema/files";
import {
  findContactByWhatsApp,
  findContactByPhoneMobile,
  findContactByPhone,
  createContactFromExternal,
  addActivityForContact,
} from "@/modules/crm";
import * as threesixtyService from "./threesixty-service";
import { REPLY_WINDOW_MS } from "../domain/constants";
import type {
  ConnectionView,
  ConversationView,
  MessageView,
  WhatsAppStats,
} from "../domain/types";
import type {
  SetupConnectionInput,
  ListConversationsInput,
  GetMessagesInput,
  SendMessageInput,
  RetryMessageInput,
  MarkAsReadInput,
  ArchiveConversationInput,
} from "../domain/validators";

// ---------------------------------------------------------------------------
// Phone normalization
// ---------------------------------------------------------------------------

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  if (cleaned.startsWith("0")) return "+49" + cleaned.slice(1);
  return "+" + cleaned;
}

// ---------------------------------------------------------------------------
// View mappers
// ---------------------------------------------------------------------------

function connectionToView(conn: WhatsAppConnection): ConnectionView {
  return {
    id: conn.id,
    displayPhone: conn.displayPhone,
    connectionStatus: conn.connectionStatus as ConnectionView["connectionStatus"],
    webhookVerified: conn.webhookVerified,
    lastError: conn.lastError ?? null,
  };
}

function conversationToView(
  conv: WhatsAppConversation,
  contact: { id: string; displayName: string; phone: string | null }
): ConversationView {
  const now = new Date();
  const expires = conv.replyWindowExpires;
  return {
    id: conv.id,
    contact,
    remotePhone: conv.remotePhone,
    status: conv.status as ConversationView["status"],
    unreadCount: conv.unreadCount,
    lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
    lastMessagePreview: conv.lastMessagePreview ?? null,
    replyWindowOpen: expires ? expires > now : false,
    replyWindowExpires: expires?.toISOString() ?? null,
    createdAt: conv.createdAt.toISOString(),
  };
}

function messageToView(
  msg: WhatsAppMessage,
  mediaStorageUrl: string | null,
  senderName: string | null
): MessageView {
  return {
    id: msg.id,
    direction: msg.direction as MessageView["direction"],
    messageType: msg.messageType as MessageView["messageType"],
    body: msg.body ?? null,
    mediaUrl: mediaStorageUrl ?? msg.mediaUrl ?? null,
    mediaMimeType: msg.mediaMimeType ?? null,
    sendStatus: (msg.sendStatus as MessageView["sendStatus"]) ?? null,
    sendError: msg.sendError ?? null,
    sentBy: msg.sentBy && senderName ? { id: msg.sentBy, name: senderName } : null,
    timestamp: msg.timestamp.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Resolve contact display name from DB record
// ---------------------------------------------------------------------------

function getDisplayName(contact: {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}): string {
  if (contact.firstName || contact.lastName) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  }
  return contact.companyName ?? "Unbekannt";
}

// ---------------------------------------------------------------------------
// getConnection
// ---------------------------------------------------------------------------

export async function getConnection(ctx: TrpcContext): Promise<ConnectionView | null> {
  const [conn] = await ctx.db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.tenantId, ctx.tenantId))
    .limit(1);
  return conn ? connectionToView(conn) : null;
}

// ---------------------------------------------------------------------------
// setupConnection
// ---------------------------------------------------------------------------

export async function setupConnection(
  input: SetupConnectionInput,
  ctx: TrpcContext
): Promise<ConnectionView> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.carlion.de"}/api/webhooks/threesixty`;

  let connectionStatus: string = "connected";
  let lastError: string | null = null;
  let webhookVerified = false;

  try {
    await threesixtyService.registerWebhook(input.phoneNumberId, webhookUrl);
    webhookVerified = true;
  } catch (err) {
    connectionStatus = "error";
    lastError = err instanceof Error ? err.message : String(err);
  }

  // Upsert connection (max 1 per tenant)
  const existing = await ctx.db
    .select({ id: whatsappConnections.id })
    .from(whatsappConnections)
    .where(eq(whatsappConnections.tenantId, ctx.tenantId))
    .limit(1)
    .then((r) => r[0]);

  let conn: WhatsAppConnection;

  if (existing) {
    const [updated] = await ctx.db
      .update(whatsappConnections)
      .set({
        phoneNumberId: input.phoneNumberId,
        displayPhone: input.displayPhone,
        wabaId: input.wabaId,
        connectionStatus,
        lastError,
        webhookVerified,
        updatedAt: new Date(),
      })
      .where(eq(whatsappConnections.id, existing.id))
      .returning();
    conn = updated!;
  } else {
    const [created] = await ctx.db
      .insert(whatsappConnections)
      .values({
        tenantId: ctx.tenantId,
        phoneNumberId: input.phoneNumberId,
        displayPhone: input.displayPhone,
        wabaId: input.wabaId,
        connectionStatus,
        lastError,
        webhookVerified,
      })
      .returning();
    conn = created!;
  }

  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "whatsapp.setupConnection",
    resourceType: "whatsapp_connection",
    resourceId: conn.id,
  });

  if (connectionStatus === "error") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Verbindung fehlgeschlagen: ${lastError}`,
    });
  }

  return connectionToView(conn);
}

// ---------------------------------------------------------------------------
// removeConnection
// ---------------------------------------------------------------------------

export async function removeConnection(ctx: TrpcContext): Promise<void> {
  const [conn] = await ctx.db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.tenantId, ctx.tenantId))
    .limit(1);

  if (!conn) return;

  // Best-effort deregister
  if (conn.phoneNumberId) {
    await threesixtyService.deregisterWebhook(conn.phoneNumberId);
  }

  await ctx.db
    .update(whatsappConnections)
    .set({
      phoneNumberId: null,  // Hard stop for inbound mapping
      connectionStatus: "disconnected",
      lastError: null,
      webhookVerified: false,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConnections.id, conn.id));

  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "whatsapp.removeConnection",
    resourceType: "whatsapp_connection",
    resourceId: conn.id,
  });
}

// ---------------------------------------------------------------------------
// listConversations
// ---------------------------------------------------------------------------

export async function listConversations(
  input: ListConversationsInput,
  ctx: TrpcContext
): Promise<{ items: ConversationView[]; nextCursor: string | null }> {
  const limit = input.limit;
  const conditions = [eq(whatsappConversations.tenantId, ctx.tenantId)];

  if (input.status) {
    conditions.push(eq(whatsappConversations.status, input.status));
  } else {
    conditions.push(eq(whatsappConversations.status, "active"));
  }

  if (input.unreadOnly) {
    conditions.push(sql`${whatsappConversations.unreadCount} > 0`);
  }

  if (input.cursor) {
    const [cursorDate, cursorId] = input.cursor.split("_");
    if (cursorDate && cursorId) {
      conditions.push(
        sql`(COALESCE(${whatsappConversations.lastMessageAt}, ${whatsappConversations.createdAt}), ${whatsappConversations.id}) < (${new Date(cursorDate)}, ${cursorId}::uuid)`
      );
    }
  }

  const rows = await ctx.db
    .select({
      conv: whatsappConversations,
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        companyName: contacts.companyName,
        phone: contacts.phone,
      },
    })
    .from(whatsappConversations)
    .innerJoin(contacts, eq(whatsappConversations.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(
      desc(sql`COALESCE(${whatsappConversations.lastMessageAt}, ${whatsappConversations.createdAt})`),
      desc(whatsappConversations.id)
    )
    .limit(limit + 1);

  // Apply search filter in memory (name or phone)
  let filtered = rows;
  if (input.search) {
    const q = input.search.toLowerCase();
    filtered = rows.filter((r) => {
      const name = getDisplayName(r.contact).toLowerCase();
      return name.includes(q) || r.conv.remotePhone.includes(q);
    });
  }

  const hasMore = filtered.length > limit;
  const items = hasMore ? filtered.slice(0, limit) : filtered;

  const views: ConversationView[] = items.map((r) => conversationToView(r.conv, {
    id: r.contact.id,
    displayName: getDisplayName(r.contact),
    phone: r.contact.phone ?? null,
  }));

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? `${(lastItem.conv.lastMessageAt ?? lastItem.conv.createdAt).toISOString()}_${lastItem.conv.id}`
    : null;

  return { items: views, nextCursor };
}

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------

export async function getMessages(
  input: GetMessagesInput,
  ctx: TrpcContext
): Promise<{ items: MessageView[]; nextCursor: string | null }> {
  // Verify conversation belongs to tenant
  const [conv] = await ctx.db
    .select({ id: whatsappConversations.id })
    .from(whatsappConversations)
    .where(and(
      eq(whatsappConversations.id, input.conversationId),
      eq(whatsappConversations.tenantId, ctx.tenantId)
    ))
    .limit(1);

  if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

  const limit = input.limit;
  const conditions = [
    eq(whatsappMessages.conversationId, input.conversationId),
    eq(whatsappMessages.tenantId, ctx.tenantId),
  ];

  if (input.cursor) {
    const [cursorTs, cursorId] = input.cursor.split("_");
    if (cursorTs && cursorId) {
      conditions.push(
        sql`(${whatsappMessages.timestamp}, ${whatsappMessages.id}) < (${new Date(cursorTs)}, ${cursorId}::uuid)`
      );
    }
  }

  const rows = await ctx.db
    .select()
    .from(whatsappMessages)
    .where(and(...conditions))
    .orderBy(desc(whatsappMessages.timestamp), desc(whatsappMessages.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Resolve sender names
  const senderIds = [...new Set(items.filter((r) => r.sentBy).map((r) => r.sentBy!))];
  const senderMap = new Map<string, string>();
  if (senderIds.length > 0) {
    const userRows = await ctx.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, senderIds));
    userRows.forEach((u) => senderMap.set(u.id, u.name ?? "Unbekannt"));
  }

  // Resolve storage URLs
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const fileIds = [...new Set(items.filter((r) => r.mediaFileId).map((r) => r.mediaFileId!))];
  const fileMap = new Map<string, string>();
  if (fileIds.length > 0) {
    const fileRows = await ctx.db
      .select({ id: files.id, storagePath: files.storagePath })
      .from(files)
      .where(inArray(files.id, fileIds));
    fileRows.forEach((f) => fileMap.set(f.id, `${supabaseUrl}/storage/v1/object/authenticated/${f.storagePath}`));
  }

  const views: MessageView[] = items.map((r) => messageToView(
    r,
    r.mediaFileId ? (fileMap.get(r.mediaFileId) ?? null) : null,
    r.sentBy ? (senderMap.get(r.sentBy) ?? null) : null
  ));

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? `${lastItem.timestamp.toISOString()}_${lastItem.id}`
    : null;

  return { items: views, nextCursor };
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

export async function sendMessage(
  input: SendMessageInput,
  ctx: TrpcContext
): Promise<MessageView> {
  // Verify conversation
  const [conv] = await ctx.db
    .select()
    .from(whatsappConversations)
    .where(and(
      eq(whatsappConversations.id, input.conversationId),
      eq(whatsappConversations.tenantId, ctx.tenantId)
    ))
    .limit(1);

  if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

  // Check 24h window
  if (!conv.replyWindowExpires || conv.replyWindowExpires <= new Date()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Das 24-Stunden-Antwortfenster ist abgelaufen. Eine Antwort ist nicht mehr möglich.",
    });
  }

  // Get connection
  const [conn] = await ctx.db
    .select()
    .from(whatsappConnections)
    .where(and(
      eq(whatsappConnections.tenantId, ctx.tenantId),
      eq(whatsappConnections.connectionStatus, "connected")
    ))
    .limit(1);

  if (!conn?.phoneNumberId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Keine aktive WhatsApp-Verbindung." });
  }

  const now = new Date();

  // Save message locally first
  const [msg] = await ctx.db
    .insert(whatsappMessages)
    .values({
      tenantId: ctx.tenantId,
      conversationId: input.conversationId,
      direction: "outbound",
      messageType: "text",
      body: input.body,
      sendStatus: "sending",
      activityCreated: false,
      sentBy: ctx.userId,
      timestamp: now,
    })
    .returning();

  // Update conversation preview
  await ctx.db
    .update(whatsappConversations)
    .set({
      lastMessageAt: now,
      lastMessagePreview: input.body.slice(0, 100),
      updatedAt: now,
    })
    .where(eq(whatsappConversations.id, input.conversationId));

  // Send directly (not via outbox)
  try {
    const result = await threesixtyService.sendTextMessage(conn.phoneNumberId, conv.remotePhone, input.body);

    // Update message with external ID and status
    const [updated] = await ctx.db
      .update(whatsappMessages)
      .set({
        externalMessageId: result.externalMessageId,
        sendStatus: "sent",
        updatedAt: new Date(),
      })
      .where(eq(whatsappMessages.id, msg!.id))
      .returning();

    // CRM activity after successful send
    await addActivityForContact(
      {
        contactId: conv.contactId,
        activityType: "whatsapp_out",
        title: "WhatsApp-Nachricht gesendet",
        description: input.body,
        messageId: msg!.id,
        performedBy: ctx.userId,
      },
      ctx.tenantId,
      ctx.db
    );

    await ctx.db
      .update(whatsappMessages)
      .set({ activityCreated: true })
      .where(eq(whatsappMessages.id, msg!.id));

    return messageToView(updated!, null, null);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    const [failed] = await ctx.db
      .update(whatsappMessages)
      .set({ sendStatus: "failed", sendError: errorMsg, updatedAt: new Date() })
      .where(eq(whatsappMessages.id, msg!.id))
      .returning();

    // Outbox retry
    await ctx.db.insert(outbox).values({
      tenantId: ctx.tenantId,
      service: "threesixty",
      action: "retry_send",
      payload: { messageId: msg!.id },
    });

    return messageToView(failed!, null, null);
  }
}

// ---------------------------------------------------------------------------
// retryMessage
// ---------------------------------------------------------------------------

export async function retryMessage(
  input: RetryMessageInput,
  ctx: TrpcContext
): Promise<MessageView> {
  const [msg] = await ctx.db
    .select()
    .from(whatsappMessages)
    .where(and(
      eq(whatsappMessages.id, input.messageId),
      eq(whatsappMessages.tenantId, ctx.tenantId)
    ))
    .limit(1);

  if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
  if (msg.sendStatus !== "failed") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Nur fehlgeschlagene Nachrichten können erneut gesendet werden." });
  }

  const [conv] = await ctx.db
    .select()
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, msg.conversationId))
    .limit(1);

  if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

  const [conn] = await ctx.db
    .select()
    .from(whatsappConnections)
    .where(and(
      eq(whatsappConnections.tenantId, ctx.tenantId),
      eq(whatsappConnections.connectionStatus, "connected")
    ))
    .limit(1);

  if (!conn?.phoneNumberId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Keine aktive WhatsApp-Verbindung." });
  }

  await ctx.db
    .update(whatsappMessages)
    .set({ sendStatus: "sending", sendError: null, updatedAt: new Date() })
    .where(eq(whatsappMessages.id, msg.id));

  try {
    const result = await threesixtyService.sendTextMessage(conn.phoneNumberId, conv.remotePhone, msg.body ?? "");

    const [updated] = await ctx.db
      .update(whatsappMessages)
      .set({ externalMessageId: result.externalMessageId, sendStatus: "sent", updatedAt: new Date() })
      .where(eq(whatsappMessages.id, msg.id))
      .returning();

    // CRM activity only if not yet created
    if (!msg.activityCreated) {
      await addActivityForContact(
        {
          contactId: conv.contactId,
          activityType: "whatsapp_out",
          title: "WhatsApp-Nachricht gesendet (Retry)",
          description: msg.body ?? undefined,
          messageId: msg.id,
          performedBy: ctx.userId,
        },
        ctx.tenantId,
        ctx.db
      );
      await ctx.db
        .update(whatsappMessages)
        .set({ activityCreated: true })
        .where(eq(whatsappMessages.id, msg.id));
    }

    return messageToView(updated!, null, null);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const [failed] = await ctx.db
      .update(whatsappMessages)
      .set({ sendStatus: "failed", sendError: errorMsg, updatedAt: new Date() })
      .where(eq(whatsappMessages.id, msg.id))
      .returning();
    return messageToView(failed!, null, null);
  }
}

// ---------------------------------------------------------------------------
// markAsRead
// ---------------------------------------------------------------------------

export async function markAsRead(
  input: MarkAsReadInput,
  ctx: TrpcContext
): Promise<ConversationView> {
  const [conv] = await ctx.db
    .select()
    .from(whatsappConversations)
    .where(and(
      eq(whatsappConversations.id, input.conversationId),
      eq(whatsappConversations.tenantId, ctx.tenantId)
    ))
    .limit(1);

  if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

  const [updated] = await ctx.db
    .update(whatsappConversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(eq(whatsappConversations.id, input.conversationId))
    .returning();

  const [contact] = await ctx.db
    .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, companyName: contacts.companyName, phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, conv.contactId))
    .limit(1);

  return conversationToView(updated!, {
    id: contact!.id,
    displayName: getDisplayName(contact!),
    phone: contact!.phone ?? null,
  });
}

// ---------------------------------------------------------------------------
// archiveConversation
// ---------------------------------------------------------------------------

export async function archiveConversation(
  input: ArchiveConversationInput,
  ctx: TrpcContext
): Promise<ConversationView> {
  const [conv] = await ctx.db
    .select()
    .from(whatsappConversations)
    .where(and(
      eq(whatsappConversations.id, input.conversationId),
      eq(whatsappConversations.tenantId, ctx.tenantId)
    ))
    .limit(1);

  if (!conv) throw new TRPCError({ code: "NOT_FOUND" });

  const [updated] = await ctx.db
    .update(whatsappConversations)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(whatsappConversations.id, input.conversationId))
    .returning();

  const [contact] = await ctx.db
    .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, companyName: contacts.companyName, phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, conv.contactId))
    .limit(1);

  return conversationToView(updated!, {
    id: contact!.id,
    displayName: getDisplayName(contact!),
    phone: contact!.phone ?? null,
  });
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

export async function getStats(ctx: TrpcContext): Promise<WhatsAppStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalResult, unreadResult, todayResult, weekResult] = await Promise.all([
    ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappConversations)
      .where(eq(whatsappConversations.tenantId, ctx.tenantId)),

    ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappConversations)
      .where(and(
        eq(whatsappConversations.tenantId, ctx.tenantId),
        sql`${whatsappConversations.unreadCount} > 0`
      )),

    ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.tenantId, ctx.tenantId),
        sql`${whatsappMessages.timestamp} >= ${startOfToday}`
      )),

    ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.tenantId, ctx.tenantId),
        sql`${whatsappMessages.timestamp} >= ${startOfWeek}`
      )),
  ]);

  return {
    totalConversations: totalResult[0]?.count ?? 0,
    unreadConversations: unreadResult[0]?.count ?? 0,
    messagesToday: todayResult[0]?.count ?? 0,
    messagesThisWeek: weekResult[0]?.count ?? 0,
    avgResponseTimeMinutes: null, // Phase 2
  };
}

// ---------------------------------------------------------------------------
// Inbound webhook processing
// ---------------------------------------------------------------------------

/**
 * Process a single webhook_log entry (used by fast-path and cron).
 * Idempotent: safe to call multiple times per entry.
 */
export async function processWebhookEntry(
  entry: { id: string; payload: unknown },
  db: TrpcContext["db"]
): Promise<void> {
  const payload = entry.payload as Record<string, unknown>;

  // Identify event type from 360dialog payload
  const messages = (payload.messages as unknown[] | undefined) ?? [];
  const statuses = (payload.statuses as unknown[] | undefined) ?? [];

  for (const rawMsg of messages) {
    await processInboundMessage(rawMsg as Record<string, unknown>, db);
  }

  for (const rawStatus of statuses) {
    await processStatusUpdate(rawStatus as Record<string, unknown>, db);
  }

  // Mark log entry as processed
  await db
    .update(webhookLog)
    .set({ processed: true, processedAt: new Date() })
    .where(eq(webhookLog.id, entry.id));
}

async function processInboundMessage(
  raw: Record<string, unknown>,
  db: TrpcContext["db"]
): Promise<void> {
  const from = raw.from as string | undefined;
  const phoneNumberId = (raw.metadata as Record<string, string> | undefined)?.phone_number_id
    ?? (raw.phone_number_id as string | undefined);
  const externalId = raw.id as string | undefined;
  const timestamp = raw.timestamp
    ? new Date(parseInt(raw.timestamp as string) * 1000)
    : new Date();
  const type = (raw.type as string) ?? "text";
  const body = type === "text"
    ? ((raw.text as Record<string, string> | undefined)?.body ?? null)
    : null;
  const mediaUrl = (raw.image as Record<string, string> | undefined)?.link
    ?? (raw.document as Record<string, string> | undefined)?.link
    ?? (raw.audio as Record<string, string> | undefined)?.link
    ?? (raw.video as Record<string, string> | undefined)?.link
    ?? null;
  const mediaMimeType = (raw.image as Record<string, string> | undefined)?.mime_type
    ?? (raw.document as Record<string, string> | undefined)?.mime_type
    ?? null;

  if (!from || !phoneNumberId) return;

  const normalizedPhone = normalizePhone(from);

  // Find tenant via phone_number_id
  const [conn] = await db
    .select({ tenantId: whatsappConnections.tenantId, id: whatsappConnections.id })
    .from(whatsappConnections)
    .where(and(
      eq(whatsappConnections.phoneNumberId, phoneNumberId),
      eq(whatsappConnections.connectionStatus, "connected")
    ))
    .limit(1);

  if (!conn) return; // Unknown or disconnected

  const tenantId = conn.tenantId;

  // Contact matching (hierarchical)
  let contact = await findContactByWhatsApp(normalizedPhone, tenantId, db);
  let matched = !!contact;

  if (!contact) {
    contact = await findContactByPhoneMobile(normalizedPhone, tenantId, db);
    if (contact) {
      // Update whatsapp_number on matched contact
      await db
        .update(contacts)
        .set({ whatsappNumber: normalizedPhone })
        .where(eq(contacts.id, contact.id));
    }
  }

  if (!contact) {
    contact = await findContactByPhone(normalizedPhone, tenantId, db);
    if (contact) {
      await db
        .update(contacts)
        .set({ whatsappNumber: normalizedPhone })
        .where(eq(contacts.id, contact.id));
    }
  }

  if (!contact) {
    // Create new contact
    const result = await createContactFromExternal(
      {
        lastName: "Unbekannt",
        whatsappNumber: normalizedPhone,
        source: "whatsapp",
      },
      tenantId,
      db
    );
    contact = result.contact;
    matched = false;
  }

  // Find or create conversation
  let [conv] = await db
    .select()
    .from(whatsappConversations)
    .where(and(
      eq(whatsappConversations.tenantId, tenantId),
      eq(whatsappConversations.remotePhone, normalizedPhone)
    ))
    .limit(1);

  const now = new Date();
  const replyWindowExpires = new Date(now.getTime() + REPLY_WINDOW_MS);

  if (conv) {
    // Reactivate if archived
    [conv] = await db
      .update(whatsappConversations)
      .set({
        status: "active",
        contactId: contact.id,
        unreadCount: sql`${whatsappConversations.unreadCount} + 1`,
        lastMessageAt: timestamp,
        lastMessagePreview: body ? body.slice(0, 100) : `[${type}]`,
        replyWindowExpires,
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, conv.id))
      .returning();
  } else {
    [conv] = await db
      .insert(whatsappConversations)
      .values({
        tenantId,
        contactId: contact.id,
        remotePhone: normalizedPhone,
        status: "active",
        unreadCount: 1,
        lastMessageAt: timestamp,
        lastMessagePreview: body ? body.slice(0, 100) : `[${type}]`,
        replyWindowExpires,
      })
      .returning();
  }

  // Dedup: skip if message already exists
  if (externalId) {
    const existing = await db
      .select({ id: whatsappMessages.id })
      .from(whatsappMessages)
      .where(and(
        eq(whatsappMessages.tenantId, tenantId),
        eq(whatsappMessages.externalMessageId, externalId)
      ))
      .limit(1);
    if (existing.length > 0) return;
  }

  // Save message
  const [msg] = await db
    .insert(whatsappMessages)
    .values({
      tenantId,
      conversationId: conv!.id,
      direction: "inbound",
      messageType: type as WhatsAppMessage["messageType"],
      body,
      mediaUrl,
      mediaMimeType,
      externalMessageId: externalId,
      activityCreated: false,
      timestamp,
    })
    .returning();

  // CRM activity for inbound
  await addActivityForContact(
    {
      contactId: contact.id,
      activityType: "whatsapp_in",
      title: "WhatsApp-Nachricht erhalten",
      description: body ?? `[${type}]`,
      messageId: msg!.id,
    },
    tenantId,
    db
  );

  await db
    .update(whatsappMessages)
    .set({ activityCreated: true })
    .where(eq(whatsappMessages.id, msg!.id));
}

async function processStatusUpdate(
  raw: Record<string, unknown>,
  db: TrpcContext["db"]
): Promise<void> {
  const externalId = raw.id as string | undefined;
  const status = raw.status as string | undefined;
  const phoneNumberId = (raw.metadata as Record<string, string> | undefined)?.phone_number_id
    ?? (raw.phone_number_id as string | undefined);

  if (!externalId || !status || !phoneNumberId) return;

  // Find tenant
  const [conn] = await db
    .select({ tenantId: whatsappConnections.tenantId })
    .from(whatsappConnections)
    .where(eq(whatsappConnections.phoneNumberId, phoneNumberId))
    .limit(1);

  if (!conn) return;

  const [msg] = await db
    .select()
    .from(whatsappMessages)
    .where(and(
      eq(whatsappMessages.tenantId, conn.tenantId),
      eq(whatsappMessages.externalMessageId, externalId)
    ))
    .limit(1);

  if (!msg) return;

  await db
    .update(whatsappMessages)
    .set({ sendStatus: status, updatedAt: new Date() })
    .where(eq(whatsappMessages.id, msg.id));

  // Create CRM activity when status reaches 'sent' and not yet created
  if (status === "sent" && !msg.activityCreated) {
    const [conv] = await db
      .select({ contactId: whatsappConversations.contactId })
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, msg.conversationId))
      .limit(1);

    if (conv) {
      await addActivityForContact(
        {
          contactId: conv.contactId,
          activityType: "whatsapp_out",
          title: "WhatsApp-Nachricht gesendet",
          description: msg.body ?? undefined,
          messageId: msg.id,
        },
        conn.tenantId,
        db
      );
      await db
        .update(whatsappMessages)
        .set({ activityCreated: true })
        .where(eq(whatsappMessages.id, msg.id));
    }
  }
}

// ---------------------------------------------------------------------------
// Cross-module exports
// ---------------------------------------------------------------------------

export async function getConversationForContact(
  contactId: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<ConversationView | null> {
  const rows = await db
    .select({
      conv: whatsappConversations,
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        companyName: contacts.companyName,
        phone: contacts.phone,
      },
    })
    .from(whatsappConversations)
    .innerJoin(contacts, eq(whatsappConversations.contactId, contacts.id))
    .where(and(
      eq(whatsappConversations.contactId, contactId),
      eq(whatsappConversations.tenantId, tenantId)
    ))
    .limit(1);

  if (!rows[0]) return null;
  const r = rows[0];
  return conversationToView(r.conv, {
    id: r.contact.id,
    displayName: getDisplayName(r.contact),
    phone: r.contact.phone ?? null,
  });
}

export async function getUnreadCount(tenantId: string, db: TrpcContext["db"]): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(whatsappConversations)
    .where(and(
      eq(whatsappConversations.tenantId, tenantId),
      sql`${whatsappConversations.unreadCount} > 0`
    ));
  return result[0]?.count ?? 0;
}

// AI tool helper — find messages by contact name or conversation ID
export async function getMessagesByContactOrId(
  params: { conversationId?: string; contactName?: string },
  ctx: TrpcContext
): Promise<{ items: MessageView[] }> {
  let conversationId = params.conversationId;

  if (!conversationId && params.contactName) {
    const convRows = await ctx.db
      .select({ convId: whatsappConversations.id })
      .from(whatsappConversations)
      .innerJoin(contacts, eq(whatsappConversations.contactId, contacts.id))
      .where(and(
        eq(whatsappConversations.tenantId, ctx.tenantId),
        or(
          ilike(contacts.firstName, `%${params.contactName}%`),
          ilike(contacts.lastName, `%${params.contactName}%`),
          ilike(contacts.companyName, `%${params.contactName}%`)
        )
      ))
      .limit(1);
    conversationId = convRows[0]?.convId;
  }

  if (!conversationId) return { items: [] };

  const { items } = await getMessages({ conversationId, limit: 20 }, ctx);
  return { items };
}
