/**
 * Listings Service — all business logic for the Börsen-Hub.
 *
 * tRPC router is a thin orchestration layer; all real work happens here.
 * Spec: MOD_13
 */

import { eq, and, isNull, isNotNull, inArray, sql, asc, desc, lt, not, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "@/server/trpc/context";
import {
  listingConnections,
  listings,
  listingInquiries,
  importSessions,
} from "../db/schema";
import type {
  ListingConnection,
  Listing,
  ListingInquiry,
  ImportSession,
} from "../db/schema";
import { vehicles } from "@/modules/inventory";
import { contacts } from "@/modules/crm";
import { files } from "@/server/db/schema/files";
import { outbox } from "@/server/db/schema/outbox";
import { auditLog } from "@/server/db/schema/audit-log";
import { users } from "@/server/db/schema/users";
import { bulkUpsertVehicles, getVehicleById, getVehiclesForTenant } from "@/modules/inventory";
import { createContactFromExternal, addActivityForContact } from "@/modules/crm";
import { createDealFromExternal } from "@/modules/sales";
import { encrypt, decrypt } from "@/shared/lib/encryption";
import * as mobileDe from "@/server/services/mobile-de";
import * as autoScout24 from "@/server/services/autoscout24";
import {
  PLATFORM_VALUES,
  AUTO_DEACTIVATE_STATUSES,
  IMPORT_SESSION_TTL_MS,
  DRAIN_TIMEOUT_HOURS,
  DEFAULT_LIST_LIMIT,
  OUTBOX_SERVICE,
} from "../domain/constants";
import type {
  Platform,
  SyncStatus,
  ConnectionView,
  ListingView,
  InquiryView,
  ImportSessionView,
  ListingsStats,
  VehicleImportRow,
  BoerenSyncPayload,
} from "../domain/types";
import type {
  SetupConnectionInput,
  RemoveConnectionInput,
  ListListingsInput,
  CreateListingInput,
  DeactivateListingInput,
  SyncNowInput,
  GetImportSessionInput,
  ConfirmImportInput,
  ListInquiriesInput,
  ProcessInquiryInput,
  GetStatsInput,
} from "../domain/validators";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
function storageUrl(path: string): string {
  return `${SUPABASE_URL()}/storage/v1/object/public/${path}`;
}

async function resolveMainPhotoUrl(vehicleId: string, db: TrpcContext["db"]): Promise<string | null> {
  const [row] = await db
    .select({ storagePath: files.storagePath })
    .from(files)
    .where(and(eq(files.entityType, "vehicle"), eq(files.entityId, vehicleId), isNull(files.deletedAt), eq(files.kind, "thumbnail_list")))
    .orderBy(asc(files.position))
    .limit(1);
  return row ? storageUrl(row.storagePath) : null;
}

async function listingToView(listing: Listing, db: TrpcContext["db"]): Promise<ListingView> {
  const [vehicle] = await db
    .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model, askingPriceGross: vehicles.askingPriceGross })
    .from(vehicles)
    .where(eq(vehicles.id, listing.vehicleId))
    .limit(1);
  const mainPhotoUrl = await resolveMainPhotoUrl(listing.vehicleId, db);
  return {
    id: listing.id,
    vehicle: {
      id: vehicle?.id ?? "",
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      askingPrice: vehicle?.askingPriceGross ?? null,
      mainPhotoUrl,
    },
    platform: listing.platform as Platform,
    externalId: listing.externalId ?? null,
    externalUrl: listing.externalUrl ?? null,
    syncStatus: listing.syncStatus as SyncStatus,
    lastSyncedAt: listing.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: listing.lastSyncError ?? null,
    viewsTotal: listing.viewsTotal,
    clicksTotal: listing.clicksTotal,
    inquiriesTotal: listing.inquiriesTotal,
    createdAt: listing.createdAt.toISOString(),
  };
}

async function inquiryToView(inquiry: ListingInquiry, db: TrpcContext["db"]): Promise<InquiryView> {
  const [vehicle] = await db
    .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model })
    .from(vehicles).where(eq(vehicles.id, inquiry.vehicleId)).limit(1);

  const mainPhotoUrl = await resolveMainPhotoUrl(inquiry.vehicleId, db);

  let contact: { id: string; displayName: string } | null = null;
  if (inquiry.contactId) {
    const [c] = await db
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, companyName: contacts.companyName })
      .from(contacts).where(eq(contacts.id, inquiry.contactId)).limit(1);
    if (c) {
      const displayName = c.lastName
        ? [c.firstName, c.lastName].filter(Boolean).join(" ")
        : c.companyName ?? "Unbekannt";
      contact = { id: c.id, displayName };
    }
  }

  return {
    id: inquiry.id,
    vehicle: { id: vehicle?.id ?? "", make: vehicle?.make ?? "", model: vehicle?.model ?? "", mainPhotoUrl },
    platform: inquiry.platform as Platform,
    inquirerName: inquiry.inquirerName ?? null,
    inquirerEmail: inquiry.inquirerEmail ?? null,
    inquirerPhone: inquiry.inquirerPhone ?? null,
    message: inquiry.message ?? null,
    processed: inquiry.processed,
    processingNotes: inquiry.processingNotes ?? null,
    contact,
    deal: inquiry.dealId ? { id: inquiry.dealId, stage: "inquiry" } : null,
    receivedAt: inquiry.receivedAt.toISOString(),
  };
}

async function connectionToView(
  connection: ListingConnection,
  db: TrpcContext["db"]
): Promise<ConnectionView> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listings)
    .where(
      and(
        eq(listings.tenantId, connection.tenantId),
        eq(listings.platform, connection.platform),
        ne(listings.syncStatus, "deactivated")
      )
    );

  const count = result[0]?.count ?? 0;

  return {
    id: connection.id,
    platform: connection.platform as Platform,
    dealerId: connection.dealerId ?? null,
    connectionStatus: connection.connectionStatus as ConnectionView["connectionStatus"],
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    lastError: connection.lastError ?? null,
    listingsCount: count,
  };
}

function getApiClient(platform: Platform) {
  return platform === "mobile_de" ? mobileDe : autoScout24;
}

// ---------------------------------------------------------------------------
// getConnections
// ---------------------------------------------------------------------------

export async function getConnections(ctx: TrpcContext): Promise<ConnectionView[]> {
  const rows = await ctx.db
    .select()
    .from(listingConnections)
    .where(eq(listingConnections.tenantId, ctx.tenantId))
    .orderBy(asc(listingConnections.platform));
  return Promise.all(rows.map((c) => connectionToView(c, ctx.db)));
}

// ---------------------------------------------------------------------------
// setupConnection
// ---------------------------------------------------------------------------

export async function setupConnection(
  input: SetupConnectionInput,
  ctx: TrpcContext
): Promise<ConnectionView> {
  const apiClient = getApiClient(input.platform);
  const testResult = await apiClient.testConnection(input.apiKey, input.dealerId);

  const encryptedKey = encrypt(input.apiKey);
  const connectionStatus = testResult.ok ? "connected" : "error";

  const existing = await ctx.db
    .select({ id: listingConnections.id })
    .from(listingConnections)
    .where(and(eq(listingConnections.tenantId, ctx.tenantId), eq(listingConnections.platform, input.platform)))
    .limit(1);

  let connection: ListingConnection;
  if (existing[0]) {
    const [updated] = await ctx.db
      .update(listingConnections)
      .set({
        apiKeyEncrypted: encryptedKey,
        dealerId: input.dealerId,
        connectionStatus,
        lastError: testResult.ok ? null : (testResult.error ?? null),
        updatedAt: new Date(),
      })
      .where(eq(listingConnections.id, existing[0].id))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    connection = updated;
  } else {
    const [created] = await ctx.db
      .insert(listingConnections)
      .values({
        tenantId: ctx.tenantId,
        platform: input.platform,
        apiKeyEncrypted: encryptedKey,
        dealerId: input.dealerId,
        connectionStatus,
        lastError: testResult.ok ? null : (testResult.error ?? null),
      })
      .returning();
    if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    connection = created;
  }

  return connectionToView(connection, ctx.db);
}

// ---------------------------------------------------------------------------
// removeConnection — drain first, credentials deleted after drain
// ---------------------------------------------------------------------------

export async function removeConnection(
  input: RemoveConnectionInput,
  ctx: TrpcContext
): Promise<ConnectionView> {
  const [connection] = await ctx.db
    .select()
    .from(listingConnections)
    .where(and(eq(listingConnections.id, input.connectionId), eq(listingConnections.tenantId, ctx.tenantId)))
    .limit(1);
  if (!connection) throw new TRPCError({ code: "NOT_FOUND" });

  // Set status to draining
  const [updated] = await ctx.db
    .update(listingConnections)
    .set({ connectionStatus: "draining", updatedAt: new Date() })
    .where(eq(listingConnections.id, connection.id))
    .returning();
  if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  // Queue outbox entries for all active listings on this platform
  const activeListings = await ctx.db
    .select({ id: listings.id, vehicleId: listings.vehicleId })
    .from(listings)
    .where(
      and(
        eq(listings.tenantId, ctx.tenantId),
        eq(listings.platform, connection.platform),
        not(inArray(listings.syncStatus, ["deactivated"]))
      )
    );

  for (const listing of activeListings) {
    await ctx.db.insert(outbox).values({
      tenantId: ctx.tenantId,
      service: OUTBOX_SERVICE,
      action: "deactivate_listing",
      payload: { listingId: listing.id, vehicleId: listing.vehicleId, platform: connection.platform, tenantId: ctx.tenantId } as BoerenSyncPayload,
      status: "pending",
      nextAttemptAt: new Date(),
    });
  }

  return connectionToView(updated, ctx.db);
}

// ---------------------------------------------------------------------------
// listListings
// ---------------------------------------------------------------------------

export async function listListings(
  input: ListListingsInput,
  ctx: TrpcContext
): Promise<{ items: ListingView[]; nextCursor: string | null }> {
  const limit = input.limit ?? DEFAULT_LIST_LIMIT;
  const conditions = [eq(listings.tenantId, ctx.tenantId)];

  if (input.platform) conditions.push(eq(listings.platform, input.platform));
  if (input.syncStatus) conditions.push(eq(listings.syncStatus, input.syncStatus));
  if (input.vehicleId) conditions.push(eq(listings.vehicleId, input.vehicleId));

  if (input.cursor) {
    try {
      const [, cursorId] = JSON.parse(Buffer.from(input.cursor, "base64url").toString()) as [unknown, string];
      conditions.push(sql`${listings.id} != ${cursorId}` as ReturnType<typeof eq>);
    } catch { /* invalid cursor */ }
  }

  const sortDir = input.sortOrder === "asc" ? asc : desc;
  const orderBy =
    input.sortBy === "views_total"
      ? [sortDir(listings.viewsTotal), desc(listings.id)]
      : input.sortBy === "inquiries_total"
        ? [sortDir(listings.inquiriesTotal), desc(listings.id)]
        : [sortDir(listings.createdAt), desc(listings.id)];

  const rows = await ctx.db
    .select()
    .from(listings)
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const views = await Promise.all(items.map((l) => listingToView(l, ctx.db)));

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1]!;
    nextCursor = Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString("base64url");
  }

  return { items: views, nextCursor };
}

// ---------------------------------------------------------------------------
// createListing
// ---------------------------------------------------------------------------

export async function createListing(
  input: CreateListingInput,
  ctx: TrpcContext
): Promise<ListingView> {
  // Verify vehicle is published
  const vehicle = await getVehicleById(input.vehicleId, ctx.tenantId, ctx.db);
  if (!vehicle) throw new TRPCError({ code: "NOT_FOUND", message: "Fahrzeug nicht gefunden." });
  if (!vehicle.published) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Fahrzeug muss veröffentlicht sein bevor es inseriert werden kann." });
  }

  // Verify connection is connected
  const [connection] = await ctx.db
    .select({ id: listingConnections.id, connectionStatus: listingConnections.connectionStatus })
    .from(listingConnections)
    .where(and(eq(listingConnections.tenantId, ctx.tenantId), eq(listingConnections.platform, input.platform)))
    .limit(1);
  if (!connection || connection.connectionStatus !== "connected") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Keine aktive ${input.platform}-Verbindung.` });
  }

  // Check for existing active listing
  const [existing] = await ctx.db
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(
        eq(listings.tenantId, ctx.tenantId),
        eq(listings.vehicleId, input.vehicleId),
        eq(listings.platform, input.platform),
        not(eq(listings.syncStatus, "deactivated"))
      )
    )
    .limit(1);
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: "Fahrzeug ist bereits auf dieser Börse inseriert." });
  }

  // Create listing record
  const [listing] = await ctx.db
    .insert(listings)
    .values({
      tenantId: ctx.tenantId,
      vehicleId: input.vehicleId,
      platform: input.platform,
      syncStatus: "pending",
    })
    .returning();
  if (!listing) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  // Queue outbox entry for async sync
  await ctx.db.insert(outbox).values({
    tenantId: ctx.tenantId,
    service: OUTBOX_SERVICE,
    action: "create_listing",
    payload: { listingId: listing.id, vehicleId: input.vehicleId, platform: input.platform, tenantId: ctx.tenantId } satisfies BoerenSyncPayload,
    status: "pending",
    nextAttemptAt: new Date(),
  });

  return listingToView(listing, ctx.db);
}

// ---------------------------------------------------------------------------
// deactivateListing
// ---------------------------------------------------------------------------

export async function deactivateListing(
  input: DeactivateListingInput,
  ctx: TrpcContext
): Promise<ListingView> {
  const [listing] = await ctx.db
    .select()
    .from(listings)
    .where(and(eq(listings.id, input.listingId), eq(listings.tenantId, ctx.tenantId)))
    .limit(1);
  if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

  const [updated] = await ctx.db
    .update(listings)
    .set({ syncStatus: "deactivated", updatedAt: new Date() })
    .where(eq(listings.id, listing.id))
    .returning();
  if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  // Queue remote deactivation via outbox
  await ctx.db.insert(outbox).values({
    tenantId: ctx.tenantId,
    service: OUTBOX_SERVICE,
    action: "deactivate_listing",
    payload: { listingId: listing.id, vehicleId: listing.vehicleId, platform: listing.platform as Platform, tenantId: ctx.tenantId } satisfies BoerenSyncPayload,
    status: "pending",
    nextAttemptAt: new Date(),
  });

  return listingToView(updated, ctx.db);
}

// ---------------------------------------------------------------------------
// syncNow — re-queues outbox entry with next_attempt_at = now
// ---------------------------------------------------------------------------

export async function syncNow(input: SyncNowInput, ctx: TrpcContext): Promise<ListingView> {
  const [listing] = await ctx.db
    .select()
    .from(listings)
    .where(and(eq(listings.id, input.listingId), eq(listings.tenantId, ctx.tenantId)))
    .limit(1);
  if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

  const action = listing.syncStatus === "deactivated" ? "deactivate_listing" : "update_listing";
  await ctx.db.insert(outbox).values({
    tenantId: ctx.tenantId,
    service: OUTBOX_SERVICE,
    action,
    payload: { listingId: listing.id, vehicleId: listing.vehicleId, platform: listing.platform as Platform, tenantId: ctx.tenantId } satisfies BoerenSyncPayload,
    status: "pending",
    nextAttemptAt: new Date(), // immediate
  });

  return listingToView(listing, ctx.db);
}

// ---------------------------------------------------------------------------
// getImportSession
// ---------------------------------------------------------------------------

export async function getImportSession(
  input: GetImportSessionInput,
  ctx: TrpcContext
): Promise<ImportSessionView> {
  const [session] = await ctx.db
    .select()
    .from(importSessions)
    .where(and(eq(importSessions.id, input.importSessionId), eq(importSessions.tenantId, ctx.tenantId)))
    .limit(1);
  if (!session) throw new TRPCError({ code: "NOT_FOUND" });
  return sessionToView(session);
}

function sessionToView(session: ImportSession): ImportSessionView {
  const parsedVehicles = session.parsedVehicles as VehicleImportRow[];
  return {
    id: session.id,
    platform: session.platform as Platform,
    status: session.status as ImportSessionView["status"],
    preview: parsedVehicles.slice(0, 10),
    totalCount: session.vehicleCount,
    duplicateCount: session.duplicateCount,
    errors: (session.parseErrors as ImportSessionView["errors"]) ?? [],
    warnings: (session.parseWarnings as ImportSessionView["warnings"]) ?? [],
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// confirmImport — reads from DB, never from client
// ---------------------------------------------------------------------------

export async function confirmImport(
  input: ConfirmImportInput,
  ctx: TrpcContext
): Promise<{ imported: number; updated: number; errors: Array<{ sourceReference: string; message: string }> }> {
  const [session] = await ctx.db
    .select()
    .from(importSessions)
    .where(and(eq(importSessions.id, input.importSessionId), eq(importSessions.tenantId, ctx.tenantId)))
    .limit(1);

  if (!session) throw new TRPCError({ code: "NOT_FOUND" });
  if (session.status !== "pending") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Import-Session ist bereits bestätigt oder abgelaufen." });
  }
  if (new Date() > session.expiresAt) {
    await ctx.db.update(importSessions).set({ status: "expired" }).where(eq(importSessions.id, session.id));
    throw new TRPCError({ code: "BAD_REQUEST", message: "Import-Session ist abgelaufen. Bitte Datei erneut hochladen." });
  }

  const parsedVehicles = session.parsedVehicles as VehicleImportRow[];

  // Import vehicles via inventory service
  const bulkResult = await bulkUpsertVehicles({
    tenantId: ctx.tenantId,
    db: ctx.db,
    vehicles: parsedVehicles.map((v) => ({
      make: v.make,
      model: v.model,
      variant: v.variant,
      vin: v.vin,
      mileageKm: v.mileageKm,
      askingPriceGross: v.askingPriceGross,
      fuelType: v.fuelType,
      transmission: v.transmission,
      firstRegistration: v.firstRegistration,
      bodyType: v.bodyType,
      colorExterior: v.colorExterior,
      equipment: v.equipment ?? [],
      equipmentCodes: v.equipmentCodes ?? [],
      taxType: "margin" as const,          // default; dealer can correct afterwards
      source: "boersen_import" as const,
      sourceReference: v.sourceReference, // "{platform}:{external_id}"
    })),
  });

  // Create listings entries for each successfully imported vehicle
  // Find vehicle IDs by source_reference
  for (const v of parsedVehicles) {
    try {
      const [vehicleRow] = await ctx.db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(
            eq(vehicles.tenantId, ctx.tenantId),
            eq(vehicles.source, "boersen_import"),
            eq(vehicles.sourceReference, v.sourceReference)
          )
        )
        .limit(1);

      if (!vehicleRow) continue;

      // Upsert listing (file import → sync_status = 'synced', externalId from sourceReference)
      const externalId = v.externalId;
      await ctx.db
        .insert(listings)
        .values({
          tenantId: ctx.tenantId,
          vehicleId: vehicleRow.id,
          platform: session.platform as Platform,
          externalId,
          syncStatus: "synced",
          lastSyncedAt: new Date(),
        })
        .onConflictDoNothing();
    } catch { /* listing already exists — skip */ }
  }

  // Mark session as confirmed
  await ctx.db
    .update(importSessions)
    .set({ status: "confirmed" })
    .where(eq(importSessions.id, session.id));

  // Audit log
  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "import_confirmed",
    resourceType: "import_session",
    resourceId: session.id,
  });

  return { imported: bulkResult.created, updated: bulkResult.updated, errors: bulkResult.errors };
}

// ---------------------------------------------------------------------------
// listInquiries
// ---------------------------------------------------------------------------

export async function listInquiries(
  input: ListInquiriesInput,
  ctx: TrpcContext
): Promise<{ items: InquiryView[]; nextCursor: string | null }> {
  const limit = input.limit ?? DEFAULT_LIST_LIMIT;
  const conditions = [eq(listingInquiries.tenantId, ctx.tenantId)];

  if (input.platform) conditions.push(eq(listingInquiries.platform, input.platform));
  if (input.processed !== undefined) conditions.push(eq(listingInquiries.processed, input.processed));
  if (input.vehicleId) conditions.push(eq(listingInquiries.vehicleId, input.vehicleId));

  if (input.cursor) {
    try {
      const [, cursorId] = JSON.parse(Buffer.from(input.cursor, "base64url").toString()) as [unknown, string];
      conditions.push(sql`${listingInquiries.id} != ${cursorId}` as ReturnType<typeof eq>);
    } catch { /* ignore */ }
  }

  const rows = await ctx.db
    .select()
    .from(listingInquiries)
    .where(and(...conditions))
    .orderBy(desc(listingInquiries.receivedAt), desc(listingInquiries.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const views = await Promise.all(items.map((i) => inquiryToView(i, ctx.db)));

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1]!;
    nextCursor = Buffer.from(JSON.stringify([last.receivedAt.toISOString(), last.id])).toString("base64url");
  }

  return { items: views, nextCursor };
}

// ---------------------------------------------------------------------------
// processInquiry (shared logic used by both tRPC mutation and cron)
// ---------------------------------------------------------------------------

async function processInquiryInternal(
  inquiry: ListingInquiry,
  db: TrpcContext["db"]
): Promise<{ contactId: string; dealId: string | null; processingNotes: string | null }> {
  // CRM: find or create contact
  const { contact } = await createContactFromExternal(
    {
      firstName: inquiry.inquirerName?.split(" ")[0],
      lastName: inquiry.inquirerName?.split(" ").slice(1).join(" ") || inquiry.inquirerName || undefined,
      email: inquiry.inquirerEmail ?? undefined,
      phone: inquiry.inquirerPhone ?? undefined,
      source: inquiry.platform === "mobile_de" ? "mobile_de" : "autoscout24",
    },
    inquiry.tenantId,
    db
  );

  // Sales: create deal (with cross-contact guard)
  const dealResult = await createDealFromExternal(
    {
      contactId: contact.id,
      vehicleId: inquiry.vehicleId,
      source: inquiry.platform === "mobile_de" ? "mobile_de" : "autoscout24",
      internalNotes: inquiry.message ?? undefined,
    },
    inquiry.tenantId,
    db
  );

  let dealId: string | null = null;
  let processingNotes: string | null = null;

  if (dealResult.existingDealDifferentContact) {
    // Cross-contact guard: don't reuse the deal, just add a CRM interest
    processingNotes = "Bestehender Vorgang eines anderen Kontakts";
  } else {
    dealId = dealResult.deal?.id ?? null;
  }

  // CRM: add vehicle interest activity
  await addActivityForContact(
    {
      contactId: contact.id,
      activityType: "vehicle_interest",
      title: `Börsen-Anfrage über ${inquiry.platform === "mobile_de" ? "mobile.de" : "AutoScout24"}`,
      description: inquiry.message ?? undefined,
      vehicleId: inquiry.vehicleId,
      dealId: dealId ?? undefined,
    },
    inquiry.tenantId,
    db
  );

  // Mark inquiry as processed
  await db
    .update(listingInquiries)
    .set({
      processed: true,
      contactId: contact.id,
      dealId: dealId ?? null,
      processingNotes,
    })
    .where(eq(listingInquiries.id, inquiry.id));

  return { contactId: contact.id, dealId, processingNotes };
}

export async function processInquiry(
  input: ProcessInquiryInput,
  ctx: TrpcContext
): Promise<{ contactId: string; dealId: string | null; notes: string | null }> {
  const [inquiry] = await ctx.db
    .select()
    .from(listingInquiries)
    .where(and(eq(listingInquiries.id, input.inquiryId), eq(listingInquiries.tenantId, ctx.tenantId)))
    .limit(1);

  if (!inquiry) throw new TRPCError({ code: "NOT_FOUND" });
  if (inquiry.processed) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Anfrage wurde bereits verarbeitet." });
  }

  const result = await processInquiryInternal(inquiry, ctx.db);

  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "inquiry_processed",
    resourceType: "listing_inquiry",
    resourceId: inquiry.id,
  });

  return { contactId: result.contactId, dealId: result.dealId, notes: result.processingNotes };
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

export async function getStats(input: GetStatsInput, ctx: TrpcContext): Promise<ListingsStats> {
  const conditions = [eq(listings.tenantId, ctx.tenantId)];
  if (input.platform) conditions.push(eq(listings.platform, input.platform));

  const rows = await ctx.db
    .select({
      platform: listings.platform,
      syncStatus: listings.syncStatus,
      viewsTotal: listings.viewsTotal,
      clicksTotal: listings.clicksTotal,
      inquiriesTotal: listings.inquiriesTotal,
    })
    .from(listings)
    .where(and(...conditions));

  const byPlatform: Record<string, number> = {};
  const bySyncStatus: Record<string, number> = {};
  let totalViews = 0;
  let totalClicks = 0;
  let totalInquiries = 0;

  for (const r of rows) {
    byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + 1;
    bySyncStatus[r.syncStatus] = (bySyncStatus[r.syncStatus] ?? 0) + 1;
    totalViews += r.viewsTotal;
    totalClicks += r.clicksTotal;
    totalInquiries += r.inquiriesTotal;
  }

  const unprocessedResult = await ctx.db
    .select({ unprocessed: sql<number>`count(*)::int` })
    .from(listingInquiries)
    .where(and(eq(listingInquiries.tenantId, ctx.tenantId), eq(listingInquiries.processed, false)));
  const unprocessed = unprocessedResult[0]?.unprocessed ?? 0;

  return {
    totalListings: rows.length,
    byPlatform,
    bySyncStatus,
    totalViews,
    totalClicks,
    totalInquiries,
    unprocessedInquiries: unprocessed ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Cross-module exports
// ---------------------------------------------------------------------------

export async function getListingsForVehicle(
  vehicleId: string,
  ctx: TrpcContext
): Promise<ListingView[]> {
  const rows = await ctx.db
    .select()
    .from(listings)
    .where(and(eq(listings.vehicleId, vehicleId), eq(listings.tenantId, ctx.tenantId)))
    .orderBy(asc(listings.platform));
  return Promise.all(rows.map((l) => listingToView(l, ctx.db)));
}

export async function getUnprocessedInquiriesCount(
  tenantId: string,
  db: TrpcContext["db"]
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(listingInquiries)
    .where(and(eq(listingInquiries.tenantId, tenantId), eq(listingInquiries.processed, false)));
  return result[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Cron: process-outbox — boersen_sync dispatcher
// ---------------------------------------------------------------------------

export async function processOutboxEntry(
  entry: { id: string; action: string; payload: unknown; tenantId: string },
  serviceDb: TrpcContext["db"]
): Promise<void> {
  const payload = entry.payload as BoerenSyncPayload;

  // Load listing and connection
  const [listing] = await serviceDb
    .select()
    .from(listings)
    .where(eq(listings.id, payload.listingId))
    .limit(1);
  if (!listing) throw new Error(`Listing ${payload.listingId} not found`);

  const [connection] = await serviceDb
    .select({ apiKeyEncrypted: listingConnections.apiKeyEncrypted, dealerId: listingConnections.dealerId })
    .from(listingConnections)
    .where(and(eq(listingConnections.tenantId, payload.tenantId), eq(listingConnections.platform, payload.platform)))
    .limit(1);

  if (!connection?.apiKeyEncrypted || !connection.dealerId) {
    throw new Error(`No valid connection for platform ${payload.platform}`);
  }

  const apiKey = decrypt(connection.apiKeyEncrypted);
  const dealerId = connection.dealerId;
  const apiClient = getApiClient(payload.platform);

  if (entry.action === "create_listing") {
    const vehicle = await serviceDb
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, payload.vehicleId))
      .limit(1)
      .then((r) => r[0]);
    if (!vehicle) throw new Error(`Vehicle ${payload.vehicleId} not found`);

    const result = await apiClient.createListing(apiKey, dealerId, {
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant ?? undefined,
      askingPriceGross: vehicle.askingPriceGross ?? undefined,
      mileageKm: vehicle.mileageKm ?? undefined,
      fuelType: vehicle.fuelType ?? undefined,
      firstRegistration: vehicle.firstRegistration ?? undefined,
    });

    await serviceDb
      .update(listings)
      .set({ syncStatus: "synced", externalId: result.externalId, externalUrl: result.url, lastSyncedAt: new Date(), lastSyncError: null, updatedAt: new Date() })
      .where(eq(listings.id, listing.id));

  } else if (entry.action === "update_listing") {
    if (!listing.externalId) throw new Error("Listing has no externalId to update");
    const vehicle = await serviceDb.select().from(vehicles).where(eq(vehicles.id, payload.vehicleId)).limit(1).then((r) => r[0]);
    if (!vehicle) throw new Error(`Vehicle ${payload.vehicleId} not found`);

    await apiClient.updateListing(apiKey, listing.externalId, {
      make: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant ?? undefined,
      askingPriceGross: vehicle.askingPriceGross ?? undefined,
      mileageKm: vehicle.mileageKm ?? undefined,
    });

    await serviceDb
      .update(listings)
      .set({ syncStatus: "synced", lastSyncedAt: new Date(), lastSyncError: null, updatedAt: new Date() })
      .where(eq(listings.id, listing.id));

  } else if (entry.action === "deactivate_listing") {
    if (listing.externalId) {
      await apiClient.deactivateListing(apiKey, listing.externalId);
    }
    await serviceDb
      .update(listings)
      .set({ syncStatus: "deactivated", lastSyncedAt: new Date(), lastSyncError: null, updatedAt: new Date() })
      .where(eq(listings.id, listing.id));
  }
}

// ---------------------------------------------------------------------------
// Cron: listings-reconcile
// ---------------------------------------------------------------------------

export async function runReconcile(serviceDb: TrpcContext["db"]): Promise<{ queued: number; deactivated: number }> {
  let queued = 0;
  let deactivated = 0;

  // 1. Find all synced listings
  const syncedListings = await serviceDb
    .select({ id: listings.id, tenantId: listings.tenantId, vehicleId: listings.vehicleId, platform: listings.platform, lastSyncedAt: listings.lastSyncedAt })
    .from(listings)
    .where(eq(listings.syncStatus, "synced"));

  for (const listing of syncedListings) {
    const vehicle = await serviceDb
      .select({ published: vehicles.published, status: vehicles.status, updatedAt: vehicles.updatedAt, deletedAt: vehicles.deletedAt })
      .from(vehicles)
      .where(eq(vehicles.id, listing.vehicleId))
      .limit(1)
      .then((r) => r[0]);

    if (!vehicle) continue;

    const shouldDeactivate =
      !vehicle.published ||
      vehicle.deletedAt !== null ||
      (AUTO_DEACTIVATE_STATUSES as readonly string[]).includes(vehicle.status);

    if (shouldDeactivate) {
      await serviceDb.insert(outbox).values({
        tenantId: listing.tenantId,
        service: OUTBOX_SERVICE,
        action: "deactivate_listing",
        payload: { listingId: listing.id, vehicleId: listing.vehicleId, platform: listing.platform as Platform, tenantId: listing.tenantId } satisfies BoerenSyncPayload,
        status: "pending",
        nextAttemptAt: new Date(),
      });
      deactivated++;
      continue;
    }

    // Check if vehicle was updated after last sync
    if (listing.lastSyncedAt && vehicle.updatedAt && vehicle.updatedAt > listing.lastSyncedAt) {
      await serviceDb.insert(outbox).values({
        tenantId: listing.tenantId,
        service: OUTBOX_SERVICE,
        action: "update_listing",
        payload: { listingId: listing.id, vehicleId: listing.vehicleId, platform: listing.platform as Platform, tenantId: listing.tenantId } satisfies BoerenSyncPayload,
        status: "pending",
        nextAttemptAt: new Date(),
      });
      queued++;
    }
  }

  // 2. Handle draining connections — check if all listings deactivated or timeout
  const drainingConnections = await serviceDb
    .select()
    .from(listingConnections)
    .where(eq(listingConnections.connectionStatus, "draining"));

  for (const conn of drainingConnections) {
    const activeCount = await serviceDb
      .select({ count: sql<number>`count(*)::int` })
      .from(listings)
      .where(
        and(
          eq(listings.tenantId, conn.tenantId),
          eq(listings.platform, conn.platform),
          not(eq(listings.syncStatus, "deactivated"))
        )
      )
      .then((r) => r[0]?.count ?? 0);

    const drainStarted = conn.updatedAt ?? conn.createdAt;
    const hoursSinceDrain = (Date.now() - drainStarted.getTime()) / (1000 * 60 * 60);
    const timedOut = hoursSinceDrain > DRAIN_TIMEOUT_HOURS;

    if (activeCount === 0 || timedOut) {
      // Clear credentials, set disconnected
      await serviceDb
        .update(listingConnections)
        .set({
          connectionStatus: "disconnected",
          apiKeyEncrypted: null,
          lastError: timedOut ? "Drain-Timeout: Verbindung nach 24h forciert getrennt." : null,
          updatedAt: new Date(),
        })
        .where(eq(listingConnections.id, conn.id));
    }
  }

  return { queued, deactivated };
}

// ---------------------------------------------------------------------------
// Cron: listings-pull-inquiries
// ---------------------------------------------------------------------------

export async function runPullInquiries(serviceDb: TrpcContext["db"]): Promise<{ fetched: number; processed: number }> {
  let fetched = 0;
  let processed = 0;

  const activeConnections = await serviceDb
    .select()
    .from(listingConnections)
    .where(eq(listingConnections.connectionStatus, "connected"));

  for (const conn of activeConnections) {
    if (!conn.apiKeyEncrypted || !conn.dealerId) continue;

    try {
      const apiKey = decrypt(conn.apiKeyEncrypted);
      const apiClient = getApiClient(conn.platform as Platform);
      const since = conn.lastSyncAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rawInquiries = await apiClient.getInquiries(apiKey, conn.dealerId, since);

      for (const raw of rawInquiries) {
        // Find the listing by externalId
        const [listingRow] = await serviceDb
          .select({ id: listings.id, vehicleId: listings.vehicleId })
          .from(listings)
          .where(
            and(
              eq(listings.tenantId, conn.tenantId),
              eq(listings.platform, conn.platform),
              eq(listings.externalId, raw.externalListingId)
            )
          )
          .limit(1);
        if (!listingRow) continue;

        // Deduplicate by external_inquiry_id
        if (raw.externalInquiryId) {
          const [dup] = await serviceDb
            .select({ id: listingInquiries.id })
            .from(listingInquiries)
            .where(
              and(
                eq(listingInquiries.tenantId, conn.tenantId),
                eq(listingInquiries.platform, conn.platform),
                eq(listingInquiries.externalInquiryId, raw.externalInquiryId)
              )
            )
            .limit(1);
          if (dup) continue;
        }

        // Insert inquiry
        const [inquiry] = await serviceDb
          .insert(listingInquiries)
          .values({
            tenantId: conn.tenantId,
            listingId: listingRow.id,
            vehicleId: listingRow.vehicleId,
            inquirerName: raw.inquirerName ?? null,
            inquirerEmail: raw.inquirerEmail ?? null,
            inquirerPhone: raw.inquirerPhone ?? null,
            message: raw.message ?? null,
            platform: conn.platform,
            externalInquiryId: raw.externalInquiryId ?? null,
            receivedAt: raw.receivedAt ? new Date(raw.receivedAt) : new Date(),
          })
          .returning();

        if (!inquiry) continue;
        fetched++;

        // Auto-process
        try {
          await processInquiryInternal(inquiry, serviceDb);
          processed++;
        } catch {
          // Inquiry stays unprocessed — dealer can process manually
        }
      }

      // Update last_sync_at
      await serviceDb
        .update(listingConnections)
        .set({ lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(listingConnections.id, conn.id));
    } catch {
      // Connection error — continue to next connection
    }
  }

  return { fetched, processed };
}

// ---------------------------------------------------------------------------
// Cron: listings-pull-performance
// ---------------------------------------------------------------------------

export async function runPullPerformance(serviceDb: TrpcContext["db"]): Promise<{ updated: number }> {
  let updated = 0;

  const syncedListings = await serviceDb
    .select()
    .from(listings)
    .where(and(eq(listings.syncStatus, "synced"), isNotNull(listings.externalId)));

  for (const listing of syncedListings) {
    if (!listing.externalId) continue;

    const [conn] = await serviceDb
      .select({ apiKeyEncrypted: listingConnections.apiKeyEncrypted })
      .from(listingConnections)
      .where(and(eq(listingConnections.tenantId, listing.tenantId), eq(listingConnections.platform, listing.platform)))
      .limit(1);

    if (!conn?.apiKeyEncrypted) continue;

    try {
      const apiKey = decrypt(conn.apiKeyEncrypted);
      const apiClient = getApiClient(listing.platform as Platform);
      const perf = await apiClient.getListingPerformance(apiKey, listing.externalId);

      await serviceDb
        .update(listings)
        .set({
          viewsTotal: perf.views,
          clicksTotal: perf.clicks,
          inquiriesTotal: perf.inquiries,
          lastPerformanceUpdate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(listings.id, listing.id));
      updated++;
    } catch {
      // Skip — will retry on next cron run
    }
  }

  return { updated };
}

// ---------------------------------------------------------------------------
// Cron: cleanup — delete expired import sessions
// ---------------------------------------------------------------------------

export async function runCleanup(serviceDb: TrpcContext["db"]): Promise<{ deletedSessions: number }> {
  const result = await serviceDb
    .delete(importSessions)
    .where(
      and(
        lt(importSessions.expiresAt, new Date()),
        not(eq(importSessions.status, "confirmed"))
      )
    )
    .returning({ id: importSessions.id });

  return { deletedSessions: result.length };
}
