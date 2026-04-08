/**
 * Sales Service — all business logic for deal management.
 * Spec: MOD_03
 */

import { eq, and, isNull, isNotNull, inArray, ilike, or, sql, asc, desc, not } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "@/server/trpc/context";
import { deals, dealStageHistory } from "../db/schema";
import type { DealRecord } from "../db/schema";
import { contacts } from "@/modules/crm";
import { vehicles } from "@/modules/inventory";
import { files } from "@/server/db/schema/files";
import { users } from "@/server/db/schema/users";
import { auditLog } from "@/server/db/schema/audit-log";
import {
  getVehicleById,
  markVehicleAsSold,
  releaseVehicleReservation,
} from "@/modules/inventory";
import {
  getContactById,
  addActivityForContact,
  markContactAsCustomer,
} from "@/modules/crm";
import {
  STAGE_TRANSITIONS,
  OPEN_STAGE_VALUES,
  DEAL_STAGE_LABELS,
  DEAL_PRIORITY_RANK,
  DEAL_CONDITION_VISIBILITY_ROLES,
  DEFAULT_LIST_LIMIT,
} from "../domain/constants";
import type {
  DealView,
  DealViewRestricted,
  DealListItem,
  DealStage,
  DealPriority,
  DealSource,
  StageHistoryEntry,
  SalesStats,
  PipelineBoard,
  CreateDealFromExternalResult,
} from "../domain/types";
import type {
  CreateDealInput,
  UpdateDealInput,
  MoveToStageInput,
  AssignDealInput,
  DealListInput,
  PipelineBoardInput,
  SalesStatsInput,
} from "../domain/validators";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
function storageUrl(path: string): string {
  return `${SUPABASE_URL()}/storage/v1/object/public/${path}`;
}

function calcDaysInStage(stageChangedAt: Date): number {
  return Math.floor((Date.now() - stageChangedAt.getTime()) / (1000 * 60 * 60 * 24));
}

function calcHoursInStage(stageChangedAt: Date): number {
  return Math.floor((Date.now() - stageChangedAt.getTime()) / (1000 * 60 * 60));
}

async function resolveUser(
  userId: string | null,
  db: TrpcContext["db"]
): Promise<{ id: string; name: string } | null> {
  if (!userId) return null;
  const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return user ? { id: user.id, name: user.name ?? "" } : null;
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

async function resolveStageHistory(dealId: string, tenantId: string, db: TrpcContext["db"]): Promise<StageHistoryEntry[]> {
  const rows = await db
    .select()
    .from(dealStageHistory)
    .where(and(eq(dealStageHistory.dealId, dealId), eq(dealStageHistory.tenantId, tenantId)))
    .orderBy(desc(dealStageHistory.changedAt));

  const changerIds = [...new Set(rows.map((r) => r.changedBy).filter(Boolean))] as string[];
  const changerMap = new Map<string, string>();
  if (changerIds.length > 0) {
    const changers = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, changerIds));
    for (const c of changers) changerMap.set(c.id, c.name ?? "");
  }

  return rows.map((r) => ({
    id: r.id,
    fromStage: r.fromStage ?? null,
    toStage: r.toStage,
    changedBy: r.changedBy ? { id: r.changedBy, name: changerMap.get(r.changedBy) ?? "" } : null,
    changedAt: r.changedAt.toISOString(),
    durationInStageHours: r.durationInStageHours ?? null,
    notes: r.notes ?? null,
  }));
}

async function writeAuditLog(ctx: TrpcContext, action: string, resourceId: string, db: TrpcContext["db"]): Promise<void> {
  await db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action,
    resourceType: "deal",
    resourceId,
  });
}

async function recordToView(record: DealRecord, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  const { db, tenantId, role } = ctx;
  const canSeeConditions = DEAL_CONDITION_VISIBILITY_ROLES.includes(role as typeof DEAL_CONDITION_VISIBILITY_ROLES[number]);

  const [contact, vehicle, assignedUser, stageHistory, mainPhotoUrl] = await Promise.all([
    db.select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, companyName: contacts.companyName, salutation: contacts.salutation, phone: contacts.phone, email: contacts.email })
      .from(contacts).where(eq(contacts.id, record.contactId)).limit(1),
    db.select({ id: vehicles.id, make: vehicles.make, model: vehicles.model, variant: vehicles.variant, askingPriceGross: vehicles.askingPriceGross })
      .from(vehicles).where(eq(vehicles.id, record.vehicleId)).limit(1),
    resolveUser(record.assignedTo, db),
    resolveStageHistory(record.id, tenantId, db),
    resolveMainPhotoUrl(record.vehicleId, db),
  ]);

  const c = contact[0];
  const v = vehicle[0];
  const displayName = c ? (c.lastName ? [c.salutation, c.firstName, c.lastName].filter(Boolean).join(" ") : c.companyName ?? "Unbekannt") : "Unbekannt";

  const base: DealView = {
    id: record.id,
    contact: { id: c?.id ?? "", displayName, phone: c?.phone ?? null, email: c?.email ?? null },
    vehicle: { id: v?.id ?? "", make: v?.make ?? "", model: v?.model ?? "", variant: v?.variant ?? null, askingPriceGross: v?.askingPriceGross ?? null, mainPhotoUrl },
    assignedToUser: assignedUser,
    stage: record.stage as DealStage,
    stageChangedAt: record.stageChangedAt.toISOString(),
    daysInCurrentStage: calcDaysInStage(record.stageChangedAt),
    offeredPrice: canSeeConditions ? (record.offeredPrice ?? null) : null,
    finalPrice: canSeeConditions ? (record.finalPrice ?? null) : null,
    tradeInVehicle: record.tradeInVehicle ?? null,
    tradeInValue: canSeeConditions ? (record.tradeInValue ?? null) : null,
    financingRequested: record.financingRequested,
    financingNotes: canSeeConditions ? (record.financingNotes ?? null) : null,
    wonAt: record.wonAt?.toISOString() ?? null,
    lostAt: record.lostAt?.toISOString() ?? null,
    lostReason: record.lostReason ?? null,
    internalNotes: canSeeConditions ? (record.internalNotes ?? null) : null,
    priority: record.priority as DealPriority,
    source: record.source as DealSource,
    stageHistory,
    createdAt: record.createdAt.toISOString(),
  };

  if (!canSeeConditions) {
    const { offeredPrice: _o, finalPrice: _f, tradeInValue: _t, internalNotes: _n, financingNotes: _fn, ...restricted } = base;
    return restricted as DealViewRestricted;
  }

  return base;
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export async function list(input: DealListInput, ctx: TrpcContext): Promise<{ items: DealListItem[]; nextCursor: string | null }> {
  const limit = input.limit ?? DEFAULT_LIST_LIMIT;
  const fetchLimit = limit + 1;
  const conditions = [eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)];

  if (input.stage) {
    const stages = Array.isArray(input.stage) ? input.stage : [input.stage];
    conditions.push(inArray(deals.stage, stages));
  }
  if (input.assignedTo) conditions.push(eq(deals.assignedTo, input.assignedTo));
  if (input.contactId) conditions.push(eq(deals.contactId, input.contactId));
  if (input.vehicleId) conditions.push(eq(deals.vehicleId, input.vehicleId));
  if (input.priority) conditions.push(eq(deals.priority, input.priority));
  if (input.isOpen !== undefined) {
    if (input.isOpen) conditions.push(not(inArray(deals.stage, ["won", "lost"])));
    else conditions.push(inArray(deals.stage, ["won", "lost"]));
  }
  if (input.search) {
    const term = `%${input.search}%`;
    // Join search — we search contact name and vehicle make/model below
  }
  if (input.cursor) {
    try {
      const [, cursorId] = JSON.parse(Buffer.from(input.cursor, "base64url").toString()) as [unknown, string];
      conditions.push(sql`${deals.id} != ${cursorId}` as ReturnType<typeof eq>);
    } catch { /* invalid cursor */ }
  }

  const sortDir = input.sortOrder === "asc" ? asc : desc;
  let orderBy;
  switch (input.sortBy) {
    case "stage_changed_at": orderBy = [sortDir(deals.stageChangedAt), desc(deals.id)]; break;
    case "offered_price": orderBy = [sortDir(deals.offeredPrice), desc(deals.id)]; break;
    default: orderBy = [sortDir(deals.createdAt), desc(deals.id)];
  }

  // Join with contacts + vehicles for search and display fields
  const rows = await ctx.db
    .select({
      id: deals.id,
      contactId: deals.contactId,
      vehicleId: deals.vehicleId,
      assignedTo: deals.assignedTo,
      stage: deals.stage,
      stageChangedAt: deals.stageChangedAt,
      offeredPrice: deals.offeredPrice,
      priority: deals.priority,
      financingRequested: deals.financingRequested,
      createdAt: deals.createdAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      contactCompanyName: contacts.companyName,
      contactSalutation: contacts.salutation,
      contactPhone: contacts.phone,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      vehicleVariant: vehicles.variant,
      askingPriceGross: vehicles.askingPriceGross,
    })
    .from(deals)
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(vehicles, eq(deals.vehicleId, vehicles.id))
    .where(
      input.search
        ? and(...conditions, or(
            ilike(contacts.firstName, `%${input.search}%`),
            ilike(contacts.lastName, `%${input.search}%`),
            ilike(contacts.companyName, `%${input.search}%`),
            ilike(vehicles.make, `%${input.search}%`),
            ilike(vehicles.model, `%${input.search}%`),
          )!)
        : and(...conditions)
    )
    .orderBy(...orderBy)
    .limit(fetchLimit);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Batch resolve assigned users + main photos
  const assignedIds = [...new Set(items.map((r) => r.assignedTo).filter(Boolean))] as string[];
  const assignedMap = new Map<string, string>();
  if (assignedIds.length > 0) {
    const u = await ctx.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assignedIds));
    for (const usr of u) assignedMap.set(usr.id, usr.name ?? "");
  }

  const vehicleIds = [...new Set(items.map((r) => r.vehicleId))];
  const photoRows = vehicleIds.length > 0
    ? await ctx.db.select({ entityId: files.entityId, storagePath: files.storagePath, position: files.position })
        .from(files)
        .where(and(eq(files.entityType, "vehicle"), inArray(files.entityId, vehicleIds), isNull(files.deletedAt), eq(files.kind, "thumbnail_list")))
        .orderBy(asc(files.position))
    : [];
  const photoMap = new Map<string, string>();
  for (const pr of photoRows) {
    if (pr.entityId && !photoMap.has(pr.entityId)) photoMap.set(pr.entityId, storageUrl(pr.storagePath));
  }

  const listItems: DealListItem[] = items.map((r) => {
    const displayName = r.contactLastName
      ? [r.contactSalutation, r.contactFirstName, r.contactLastName].filter(Boolean).join(" ")
      : r.contactCompanyName ?? "Unbekannt";
    return {
      id: r.id,
      contactName: displayName,
      contactPhone: r.contactPhone ?? null,
      vehicleTitle: [r.vehicleMake, r.vehicleModel, r.vehicleVariant].filter(Boolean).join(" "),
      vehicleMainPhotoUrl: photoMap.get(r.vehicleId) ?? null,
      askingPrice: r.askingPriceGross ?? null,
      offeredPrice: r.offeredPrice ?? null,
      stage: r.stage as DealStage,
      daysInCurrentStage: calcDaysInStage(r.stageChangedAt),
      priority: r.priority as DealPriority,
      assignedToUser: r.assignedTo ? { id: r.assignedTo, name: assignedMap.get(r.assignedTo) ?? "" } : null,
      financingRequested: r.financingRequested,
      createdAt: r.createdAt.toISOString(),
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1]!;
    nextCursor = Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString("base64url");
  }

  return { items: listItems, nextCursor };
}

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

export async function getById(id: string, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  const [record] = await ctx.db.select().from(deals)
    .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)))
    .limit(1);
  if (!record) throw new TRPCError({ code: "NOT_FOUND" });
  return recordToView(record, ctx);
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export async function create(input: CreateDealInput, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  // Verify contact
  const contact = await getContactById(input.contactId, ctx.tenantId, ctx.db);
  if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Kontakt nicht gefunden." });

  // Verify vehicle + eligibility
  const vehicle = await getVehicleById(input.vehicleId, ctx.tenantId, ctx.db);
  if (!vehicle) throw new TRPCError({ code: "NOT_FOUND", message: "Fahrzeug nicht gefunden." });
  if (vehicle.status !== "available" && !(vehicle.status === "reserved" && vehicle.reservedForContactId === input.contactId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Fahrzeug ist nicht verkaufstauglich (Status: ${vehicle.status}).` });
  }

  const [record] = await ctx.db.insert(deals).values({
    tenantId: ctx.tenantId,
    contactId: input.contactId,
    vehicleId: input.vehicleId,
    assignedTo: ctx.userId,
    stage: "inquiry",
    offeredPrice: input.offeredPrice?.toFixed(2) ?? null,
    priority: input.priority ?? "normal",
    internalNotes: input.internalNotes ?? null,
    financingRequested: input.financingRequested ?? false,
    financingNotes: input.financingNotes ?? null,
    tradeInVehicle: input.tradeInVehicle ?? null,
    tradeInValue: input.tradeInValue?.toFixed(2) ?? null,
    source: input.source ?? "manual",
    createdBy: ctx.userId,
  }).returning();

  if (!record) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  // Stage history
  await ctx.db.insert(dealStageHistory).values({ tenantId: ctx.tenantId, dealId: record.id, fromStage: null, toStage: "inquiry", changedBy: ctx.userId });

  // CRM activity
  try {
    await addActivityForContact({ contactId: input.contactId, activityType: "deal_created", title: "Verkaufsvorgang erstellt", dealId: record.id, vehicleId: input.vehicleId }, ctx.tenantId, ctx.db);
  } catch { /* best-effort */ }

  await writeAuditLog(ctx, "create_deal", record.id, ctx.db);
  return recordToView(record, ctx);
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export async function update(input: UpdateDealInput, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  const { id, ...updates } = input;
  const [current] = await ctx.db.select().from(deals)
    .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)))
    .limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND" });

  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.offeredPrice !== undefined) updateSet.offeredPrice = updates.offeredPrice?.toFixed(2) ?? null;
  if (updates.tradeInVehicle !== undefined) updateSet.tradeInVehicle = updates.tradeInVehicle;
  if (updates.tradeInValue !== undefined) updateSet.tradeInValue = updates.tradeInValue?.toFixed(2) ?? null;
  if (updates.financingRequested !== undefined) updateSet.financingRequested = updates.financingRequested;
  if (updates.financingNotes !== undefined) updateSet.financingNotes = updates.financingNotes;
  if (updates.internalNotes !== undefined) updateSet.internalNotes = updates.internalNotes;
  if (updates.priority !== undefined) updateSet.priority = updates.priority;

  await ctx.db.update(deals).set(updateSet).where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId)));
  await writeAuditLog(ctx, "update_deal", id, ctx.db);

  return getById(id, ctx);
}

// ---------------------------------------------------------------------------
// moveToStage
// ---------------------------------------------------------------------------

export async function moveToStage(input: MoveToStageInput, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  const [current] = await ctx.db.select().from(deals)
    .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)))
    .limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND" });

  const allowed = STAGE_TRANSITIONS[current.stage as DealStage] as readonly DealStage[];
  if (!allowed.includes(input.stage)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Übergang von „${DEAL_STAGE_LABELS[current.stage as DealStage]}" nach „${DEAL_STAGE_LABELS[input.stage]}" ist nicht erlaubt.` });
  }

  const durationHours = calcHoursInStage(current.stageChangedAt);
  const now = new Date();

  // === Won-Flow ===
  if (input.stage === "won") {
    if (!input.finalPrice && input.finalPrice !== 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Abschlusspreis ist Pflicht bei Abschluss." });
    }
    // Vehicle validation
    const vehicle = await getVehicleById(current.vehicleId, ctx.tenantId, ctx.db);
    if (!vehicle) throw new TRPCError({ code: "CONFLICT", message: "Fahrzeug nicht mehr verfügbar." });
    if (vehicle.status !== "available" && !(vehicle.status === "reserved" && vehicle.reservedForContactId === current.contactId)) {
      throw new TRPCError({ code: "CONFLICT", message: `Fahrzeug kann nicht als verkauft markiert werden (Status: ${vehicle.status}).` });
    }

    // Update deal
    await ctx.db.update(deals).set({
      stage: "won", stageChangedAt: now, wonAt: now, finalPrice: input.finalPrice.toFixed(2), updatedAt: now,
    }).where(eq(deals.id, input.id));

    // Inventory side-effect (blocking)
    await markVehicleAsSold(current.vehicleId, ctx.tenantId, ctx.db);

    // CRM side-effects (best-effort)
    try {
      await markContactAsCustomer(current.contactId, ctx.tenantId, ctx.db);
      await addActivityForContact({ contactId: current.contactId, activityType: "deal_won", title: "Verkauf abgeschlossen", dealId: current.id, vehicleId: current.vehicleId }, ctx.tenantId, ctx.db);
    } catch { /* best-effort: CRM errors don't block won */ }
  }
  // === Lost-Flow ===
  else if (input.stage === "lost") {
    if (!input.lostReason) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Verlustgrund ist Pflicht." });
    }
    await ctx.db.update(deals).set({
      stage: "lost", stageChangedAt: now, lostAt: now, lostReason: input.lostReason, updatedAt: now,
    }).where(eq(deals.id, input.id));

    // Release reservation if applicable
    try {
      const vehicle = await getVehicleById(current.vehicleId, ctx.tenantId, ctx.db);
      if (vehicle && vehicle.status === "reserved" && vehicle.reservedForContactId === current.contactId) {
        await releaseVehicleReservation(current.vehicleId, ctx.tenantId, ctx.db);
      }
    } catch { /* best-effort */ }

    try {
      await addActivityForContact({ contactId: current.contactId, activityType: "deal_lost", title: "Verkauf verloren", dealId: current.id, vehicleId: current.vehicleId }, ctx.tenantId, ctx.db);
    } catch { /* best-effort */ }
  }
  // === Reopen-Flow (lost → inquiry) ===
  else if (current.stage === "lost" && input.stage === "inquiry") {
    if (!input.notes) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Begründung ist Pflicht bei Wiederbelebung." });
    }
    // Check no other open deal for this vehicle
    const [existingOpen] = await ctx.db.select({ id: deals.id }).from(deals)
      .where(and(eq(deals.vehicleId, current.vehicleId), eq(deals.tenantId, ctx.tenantId), not(inArray(deals.stage, ["won", "lost"])), isNull(deals.deletedAt), sql`${deals.id} != ${input.id}` as ReturnType<typeof eq>))
      .limit(1);
    if (existingOpen) {
      throw new TRPCError({ code: "CONFLICT", message: "Ein anderer offener Vorgang existiert bereits für dieses Fahrzeug." });
    }

    await ctx.db.update(deals).set({
      stage: "inquiry", stageChangedAt: now, lostAt: null, lostReason: null, updatedAt: now,
    }).where(eq(deals.id, input.id));

    try {
      await addActivityForContact({ contactId: current.contactId, activityType: "deal_created", title: "Vorgang wiederbelebt", description: input.notes, dealId: current.id, vehicleId: current.vehicleId }, ctx.tenantId, ctx.db);
    } catch { /* best-effort */ }
  }
  // === Regular stage transition ===
  else {
    await ctx.db.update(deals).set({
      stage: input.stage, stageChangedAt: now, updatedAt: now,
    }).where(eq(deals.id, input.id));

    try {
      await addActivityForContact({
        contactId: current.contactId,
        activityType: "note",
        title: `Phase: ${DEAL_STAGE_LABELS[current.stage as DealStage]} → ${DEAL_STAGE_LABELS[input.stage]}`,
        description: input.notes ?? undefined,
        dealId: current.id,
        vehicleId: current.vehicleId,
      }, ctx.tenantId, ctx.db);
    } catch { /* best-effort */ }
  }

  // Stage history
  await ctx.db.insert(dealStageHistory).values({
    tenantId: ctx.tenantId,
    dealId: input.id,
    fromStage: current.stage,
    toStage: input.stage,
    changedBy: ctx.userId,
    durationInStageHours: durationHours,
    notes: input.notes ?? input.lostReason ?? null,
  });

  await writeAuditLog(ctx, `stage_change:${current.stage}→${input.stage}`, input.id, ctx.db);
  return getById(input.id, ctx);
}

// ---------------------------------------------------------------------------
// assignDeal
// ---------------------------------------------------------------------------

export async function assignDeal(input: AssignDealInput, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  const [current] = await ctx.db.select({ id: deals.id }).from(deals)
    .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)))
    .limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND" });

  if (input.assignToUserId) {
    const [assignee] = await ctx.db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, input.assignToUserId), eq(users.tenantId, ctx.tenantId)))
      .limit(1);
    if (!assignee) throw new TRPCError({ code: "BAD_REQUEST", message: "Mitarbeiter nicht gefunden." });
  }

  await ctx.db.update(deals).set({ assignedTo: input.assignToUserId, updatedAt: new Date() })
    .where(and(eq(deals.id, input.id), eq(deals.tenantId, ctx.tenantId)));
  await writeAuditLog(ctx, "assign_deal", input.id, ctx.db);
  return getById(input.id, ctx);
}

// ---------------------------------------------------------------------------
// archive / restore
// ---------------------------------------------------------------------------

export async function archive(id: string, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  const [current] = await ctx.db.select({ id: deals.id, stage: deals.stage }).from(deals)
    .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)))
    .limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND" });
  if (!["won", "lost"].includes(current.stage)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Nur abgeschlossene Vorgänge können archiviert werden." });
  }
  await ctx.db.update(deals).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(deals.id, id));
  await writeAuditLog(ctx, "archive_deal", id, ctx.db);

  // Return archived deal by querying without deletedAt filter
  const [record] = await ctx.db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (!record) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return recordToView(record, ctx);
}

export async function restore(id: string, ctx: TrpcContext): Promise<DealView | DealViewRestricted> {
  const [current] = await ctx.db.select().from(deals)
    .where(and(eq(deals.id, id), eq(deals.tenantId, ctx.tenantId), isNotNull(deals.deletedAt)))
    .limit(1);
  if (!current) throw new TRPCError({ code: "NOT_FOUND" });

  await ctx.db.update(deals).set({ deletedAt: null, updatedAt: new Date() }).where(eq(deals.id, id));

  // Stage history entry
  await ctx.db.insert(dealStageHistory).values({
    tenantId: ctx.tenantId, dealId: id, fromStage: current.stage, toStage: current.stage, changedBy: ctx.userId, notes: "Wiederhergestellt",
  });

  await writeAuditLog(ctx, "restore_deal", id, ctx.db);
  return getById(id, ctx);
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

export async function getStats(input: SalesStatsInput, ctx: TrpcContext): Promise<SalesStats> {
  const rows = await ctx.db.select().from(deals)
    .where(and(eq(deals.tenantId, ctx.tenantId), isNull(deals.deletedAt)));

  const now = new Date();
  let periodStart: Date;
  switch (input.period) {
    case "quarter": periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
    case "year": periodStart = new Date(now.getFullYear(), 0, 1); break;
    default: periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const byStage: Record<DealStage, number> = { inquiry: 0, contacted: 0, viewing: 0, offer: 0, negotiation: 0, won: 0, lost: 0 };
  let openDeals = 0, wonThisPeriod = 0, lostThisPeriod = 0, totalRevenue = 0, totalClosedDays = 0, closedCount = 0, pipelineValue = 0;

  for (const r of rows) {
    const stage = r.stage as DealStage;
    if (stage in byStage) byStage[stage]++;
    if (!["won", "lost"].includes(stage)) {
      openDeals++;
      if (r.offeredPrice) pipelineValue += parseFloat(r.offeredPrice);
    }
    if (stage === "won" && r.wonAt && r.wonAt >= periodStart) {
      wonThisPeriod++;
      if (r.finalPrice) totalRevenue += parseFloat(r.finalPrice);
    }
    if (stage === "lost" && r.lostAt && r.lostAt >= periodStart) lostThisPeriod++;
    if ((stage === "won" || stage === "lost") && (r.wonAt || r.lostAt)) {
      const closeDate = r.wonAt ?? r.lostAt!;
      totalClosedDays += Math.floor((closeDate.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      closedCount++;
    }
  }

  const totalClosed = wonThisPeriod + lostThisPeriod;
  return {
    totalDeals: rows.length,
    byStage,
    openDeals,
    wonThisPeriod,
    lostThisPeriod,
    conversionRate: totalClosed > 0 ? wonThisPeriod / totalClosed : 0,
    avgDaysToClose: closedCount > 0 ? totalClosedDays / closedCount : 0,
    totalRevenueThisPeriod: totalRevenue,
    avgDealValue: wonThisPeriod > 0 ? totalRevenue / wonThisPeriod : 0,
    pipelineValue,
  };
}

// ---------------------------------------------------------------------------
// getPipelineBoard
// ---------------------------------------------------------------------------

export async function getPipelineBoard(input: PipelineBoardInput, ctx: TrpcContext): Promise<PipelineBoard> {
  const stages: PipelineBoard["stages"] = [];

  for (const stageVal of OPEN_STAGE_VALUES) {
    const conditions = [
      eq(deals.tenantId, ctx.tenantId),
      eq(deals.stage, stageVal),
      isNull(deals.deletedAt),
    ];
    if (input.assignedTo) conditions.push(eq(deals.assignedTo, input.assignedTo));

    // Get count + value
    const [countRow] = await ctx.db
      .select({ count: sql<number>`count(*)::int`, totalValue: sql<number>`coalesce(sum(offered_price::numeric), 0)` })
      .from(deals)
      .where(and(...conditions));

    // Get deals with joins
    const rows = await ctx.db
      .select({
        id: deals.id, contactId: deals.contactId, vehicleId: deals.vehicleId,
        assignedTo: deals.assignedTo, stage: deals.stage, stageChangedAt: deals.stageChangedAt,
        offeredPrice: deals.offeredPrice, priority: deals.priority, financingRequested: deals.financingRequested,
        createdAt: deals.createdAt,
        contactFirstName: contacts.firstName, contactLastName: contacts.lastName,
        contactCompanyName: contacts.companyName, contactSalutation: contacts.salutation, contactPhone: contacts.phone,
        vehicleMake: vehicles.make, vehicleModel: vehicles.model, vehicleVariant: vehicles.variant,
        askingPriceGross: vehicles.askingPriceGross,
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(vehicles, eq(deals.vehicleId, vehicles.id))
      .where(and(...conditions))
      .orderBy(desc(deals.priority), asc(deals.createdAt))
      .limit(input.limitPerStage);

    // Resolve photos + assigned
    const assignedIds = [...new Set(rows.map((r) => r.assignedTo).filter(Boolean))] as string[];
    const assignedMap = new Map<string, string>();
    if (assignedIds.length > 0) {
      const u = await ctx.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assignedIds));
      for (const usr of u) assignedMap.set(usr.id, usr.name ?? "");
    }

    const vehicleIds = [...new Set(rows.map((r) => r.vehicleId))];
    const photoMap = new Map<string, string>();
    if (vehicleIds.length > 0) {
      const photoRows = await ctx.db.select({ entityId: files.entityId, storagePath: files.storagePath })
        .from(files)
        .where(and(eq(files.entityType, "vehicle"), inArray(files.entityId, vehicleIds), isNull(files.deletedAt), eq(files.kind, "thumbnail_list")))
        .orderBy(asc(files.position));
      for (const pr of photoRows) {
        if (pr.entityId && !photoMap.has(pr.entityId)) photoMap.set(pr.entityId, storageUrl(pr.storagePath));
      }
    }

    const dealItems: DealListItem[] = rows.map((r) => ({
      id: r.id,
      contactName: r.contactLastName ? [r.contactSalutation, r.contactFirstName, r.contactLastName].filter(Boolean).join(" ") : r.contactCompanyName ?? "Unbekannt",
      contactPhone: r.contactPhone ?? null,
      vehicleTitle: [r.vehicleMake, r.vehicleModel, r.vehicleVariant].filter(Boolean).join(" "),
      vehicleMainPhotoUrl: photoMap.get(r.vehicleId) ?? null,
      askingPrice: r.askingPriceGross ?? null,
      offeredPrice: r.offeredPrice ?? null,
      stage: r.stage as DealStage,
      daysInCurrentStage: calcDaysInStage(r.stageChangedAt),
      priority: r.priority as DealPriority,
      assignedToUser: r.assignedTo ? { id: r.assignedTo, name: assignedMap.get(r.assignedTo) ?? "" } : null,
      financingRequested: r.financingRequested,
      createdAt: r.createdAt.toISOString(),
    }));

    stages.push({
      stage: stageVal,
      label: DEAL_STAGE_LABELS[stageVal],
      deals: dealItems,
      totalCount: countRow?.count ?? 0,
      totalValue: Number(countRow?.totalValue ?? 0),
    });
  }

  return { stages };
}

// ===========================================================================
// Cross-module service exports
// ===========================================================================

export async function getOpenDealForVehicle(vehicleId: string, tenantId: string, db: TrpcContext["db"]): Promise<DealRecord | null> {
  const [record] = await db.select().from(deals)
    .where(and(eq(deals.vehicleId, vehicleId), eq(deals.tenantId, tenantId), not(inArray(deals.stage, ["won", "lost"])), isNull(deals.deletedAt)))
    .limit(1);
  return record ?? null;
}

export async function getDealsForContact(contactId: string, tenantId: string, db: TrpcContext["db"]): Promise<DealRecord[]> {
  return db.select().from(deals)
    .where(and(eq(deals.contactId, contactId), eq(deals.tenantId, tenantId), isNull(deals.deletedAt)))
    .orderBy(desc(deals.createdAt));
}

export async function getOpenDealsCount(tenantId: string, db: TrpcContext["db"]): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(deals)
    .where(and(eq(deals.tenantId, tenantId), not(inArray(deals.stage, ["won", "lost"])), isNull(deals.deletedAt)));
  return row?.count ?? 0;
}

export async function createDealFromExternal(
  input: { contactId: string; vehicleId: string; source: DealSource; internalNotes?: string },
  tenantId: string,
  db: TrpcContext["db"]
): Promise<CreateDealFromExternalResult> {
  // Check for existing open deal on this vehicle
  const existing = await getOpenDealForVehicle(input.vehicleId, tenantId, db);

  if (existing) {
    if (existing.contactId === input.contactId) {
      return { deal: existing, created: false, existingDealDifferentContact: false };
    }
    // Different contact → no cross-contact reuse
    return { deal: null, created: false, existingDealDifferentContact: true };
  }

  // Verify vehicle eligibility
  const vehicle = await getVehicleById(input.vehicleId, tenantId, db);
  if (!vehicle || !["available", "reserved"].includes(vehicle.status)) {
    return { deal: null, created: false, existingDealDifferentContact: false };
  }

  const [record] = await db.insert(deals).values({
    tenantId,
    contactId: input.contactId,
    vehicleId: input.vehicleId,
    assignedTo: null, // External deals: no auto-assign
    stage: "inquiry",
    source: input.source,
    internalNotes: input.internalNotes ?? null,
    priority: "normal",
    financingRequested: false,
  }).returning();

  if (!record) return { deal: null, created: false, existingDealDifferentContact: false };

  await db.insert(dealStageHistory).values({ tenantId, dealId: record.id, fromStage: null, toStage: "inquiry", changedBy: null });

  return { deal: record, created: true, existingDealDifferentContact: false };
}
