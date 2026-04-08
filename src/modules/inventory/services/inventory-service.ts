/**
 * Inventory Service — all business logic for vehicle management.
 *
 * tRPC router is a thin orchestration layer; all real work happens here.
 * Spec: MOD_02
 */

import { eq, and, isNull, isNotNull, inArray, ilike, or, gte, lte, sql, asc, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "@/server/trpc/context";
import { vehicles } from "../db/schema";
import { files } from "@/server/db/schema/files";
import { auditLog } from "@/server/db/schema/audit-log";
import { outbox } from "@/server/db/schema/outbox";
import { callClaude, parseClaudeJson } from "@/shared/lib/ai";
import { decodeVin as datDecodeVin } from "@/server/services/dat";
import { getBrandingForTenant } from "@/modules/dna-engine";
import {
  STATUS_TRANSITIONS,
  PUBLISHABLE_STATUSES,
  PRICE_VISIBILITY_ROLES,
  LANGSTEHER_THRESHOLD_DAYS,
  DEFAULT_LIST_LIMIT,
} from "../domain/constants";
import type {
  VehicleRecord,
  VehicleView,
  VehicleViewRestricted,
  VehicleListItem,
  PublicVehicle,
  FileReference,
  FuelConsumption,
  InventoryStats,
  VehicleStatus,
  BulkUpsertResult,
  VinDecodingResult,
} from "../domain/types";
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  UpdateVehicleStatusInput,
  VehicleListInput,
  BulkUpsertVehicleItem,
} from "../domain/validators";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/shared/lib/supabase/server";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Builds a public storage URL from a storage path */
function storageUrl(path: string): string {
  return `${SUPABASE_URL()}/storage/v1/object/public/${path}`;
}

/** Resolves photo FileReferences for a vehicle from the files table */
async function resolvePhotos(
  vehicleId: string,
  db: TrpcContext["db"]
): Promise<FileReference[]> {
  const rows = await db
    .select({
      id: files.id,
      storagePath: files.storagePath,
      altText: files.altText,
      position: files.position,
      kind: files.kind,
      width: files.width,
      height: files.height,
    })
    .from(files)
    .where(
      and(
        eq(files.entityType, "vehicle"),
        eq(files.entityId, vehicleId),
        isNull(files.deletedAt)
      )
    )
    .orderBy(asc(files.position));

  return rows.map((r) => ({
    id: r.id,
    url: storageUrl(r.storagePath),
    altText: r.altText ?? null,
    position: r.position ?? 0,
    kind: (r.kind as FileReference["kind"]),
    width: r.width ?? null,
    height: r.height ?? null,
  }));
}

/** Resolves the main photo URL (position 1) for a vehicle — used in list view */
async function resolveMainPhotoUrl(
  vehicleId: string,
  db: TrpcContext["db"]
): Promise<string | null> {
  const [row] = await db
    .select({ storagePath: files.storagePath })
    .from(files)
    .where(
      and(
        eq(files.entityType, "vehicle"),
        eq(files.entityId, vehicleId),
        isNull(files.deletedAt),
        eq(files.kind, "thumbnail_list")
      )
    )
    .orderBy(asc(files.position))
    .limit(1);

  return row ? storageUrl(row.storagePath) : null;
}

/** Calculates margin based on tax_type */
function calculateMargin(
  askingPriceGross: string | null,
  purchasePriceNet: string | null,
  taxType: string
): string | null {
  if (!askingPriceGross || !purchasePriceNet) return null;
  const asking = parseFloat(askingPriceGross);
  const purchase = parseFloat(purchasePriceNet);
  if (isNaN(asking) || isNaN(purchase)) return null;

  const net = taxType === "regular" ? asking / 1.19 : asking;
  return (net - purchase).toFixed(2);
}

/** Maps a VehicleRecord + computed fields → VehicleView */
function recordToView(
  record: VehicleRecord,
  photos: FileReference[],
  daysInStock: number | null,
  canSeePrices: boolean
): VehicleView | VehicleViewRestricted {
  const margin = canSeePrices
    ? calculateMargin(record.askingPriceGross, record.purchasePriceNet, record.taxType)
    : null;

  const base: VehicleView = {
    id: record.id,
    tenantId: record.tenantId,
    vin: record.vin ?? null,
    internalNumber: record.internalNumber ?? null,
    licensePlate: record.licensePlate ?? null,
    make: record.make,
    model: record.model,
    variant: record.variant ?? null,
    modelYear: record.modelYear ?? null,
    firstRegistration: record.firstRegistration ?? null,
    bodyType: record.bodyType ?? null,
    fuelType: record.fuelType ?? null,
    transmission: record.transmission ?? null,
    driveType: record.driveType ?? null,
    engineSizeCcm: record.engineSizeCcm ?? null,
    powerKw: record.powerKw ?? null,
    powerPs: record.powerPs ?? null,
    doors: record.doors ?? null,
    seats: record.seats ?? null,
    colorExterior: record.colorExterior ?? null,
    colorInterior: record.colorInterior ?? null,
    emissionClass: record.emissionClass ?? null,
    co2Emissions: record.co2Emissions ?? null,
    fuelConsumption: (record.fuelConsumption as FuelConsumption) ?? null,
    electricRangeKm: record.electricRangeKm ?? null,
    batteryCapacityKwh: record.batteryCapacityKwh ?? null,
    mileageKm: record.mileageKm ?? null,
    condition: record.condition ?? null,
    previousOwners: record.previousOwners ?? null,
    huValidUntil: record.huValidUntil ?? null,
    accidentFree: record.accidentFree ?? null,
    nonSmoker: record.nonSmoker ?? null,
    equipment: record.equipment ?? [],
    equipmentCodes: record.equipmentCodes ?? [],
    purchasePriceNet: canSeePrices ? (record.purchasePriceNet ?? null) : null,
    askingPriceGross: record.askingPriceGross ?? null,
    minimumPriceGross: canSeePrices ? (record.minimumPriceGross ?? null) : null,
    taxType: record.taxType,
    margin,
    title: record.title ?? null,
    description: record.description ?? null,
    internalNotes: canSeePrices ? (record.internalNotes ?? null) : null,
    status: record.status,
    published: record.published,
    featured: record.featured,
    reservedForContactId: record.reservedForContactId ?? null,
    reservedAt: record.reservedAt?.toISOString() ?? null,
    soldAt: record.soldAt?.toISOString() ?? null,
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
    inStockSince: record.inStockSince ?? null,
    daysInStock,
    source: record.source,
    sourceReference: record.sourceReference ?? null,
    photos,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };

  if (!canSeePrices) {
    const { purchasePriceNet: _p, minimumPriceGross: _m, margin: _ma, internalNotes: _n, ...restricted } = base;
    return restricted as VehicleViewRestricted;
  }

  return base;
}

/** Writes to audit_log */
async function writeAuditLog(
  ctx: TrpcContext,
  action: string,
  resourceType: string,
  resourceId: string,
  db: TrpcContext["db"]
): Promise<void> {
  await db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action,
    resourceType,
    resourceId,
  });
}

/** Queues a VIN decode retry via Outbox when DAT is unavailable */
async function queueVinDecodeRetry(
  vehicleId: string,
  vin: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<void> {
  await db.insert(outbox).values({
    tenantId,
    service: "dat",
    action: "decode_vin",
    payload: { vehicleId, vin },
    status: "pending",
    nextAttemptAt: new Date(),
  });
}

/** Triggers ISR cache revalidation for public routes */
async function triggerPublicRevalidation(tenantId: string): Promise<void> {
  const revalidateUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!revalidateUrl) return;

  const secret = process.env.REVALIDATION_SECRET;
  if (!secret) return;

  try {
    await fetch(`${revalidateUrl}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ tenantId, path: "vehicles" }),
    });
  } catch {
    // Non-critical — ISR will expire on its own
  }
}

/** Deletes public photo derivatives from Supabase Storage */
async function deletePublicDerivatives(vehicleId: string, tenantId: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.storage
      .from("vehicles-public")
      .list(`${tenantId}/${vehicleId}`);

    if (data && data.length > 0) {
      const paths = data.map((f) => `${tenantId}/${vehicleId}/${f.name}`);
      await supabase.storage.from("vehicles-public").remove(paths);
    }
  } catch {
    // Non-critical — derivatives will become stale but originals are safe
  }
}

// ---------------------------------------------------------------------------
// Days in stock — query-time calculation helper
// ---------------------------------------------------------------------------

function calcDaysInStock(inStockSince: string | null, status: VehicleStatus): number | null {
  if (!inStockSince) return null;
  if (!["available", "reserved"].includes(status)) return null;
  const since = new Date(inStockSince);
  const now = new Date();
  return Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export async function list(
  input: VehicleListInput,
  ctx: TrpcContext
): Promise<{ items: VehicleListItem[]; nextCursor: string | null }> {
  const limit = input.limit ?? DEFAULT_LIST_LIMIT;
  const fetchLimit = limit + 1; // fetch one extra to detect next page

  // Build conditions
  const conditions = [eq(vehicles.tenantId, ctx.tenantId)];

  if (!input.includeArchived) {
    conditions.push(isNull(vehicles.deletedAt));
    conditions.push(sql`${vehicles.status} != 'archived'`);
  }

  if (input.status) {
    const statuses = Array.isArray(input.status) ? input.status : [input.status];
    conditions.push(inArray(vehicles.status, statuses));
  }

  if (input.published !== undefined) {
    conditions.push(eq(vehicles.published, input.published));
  }

  if (input.make) {
    conditions.push(ilike(vehicles.make, `%${input.make}%`));
  }

  if (input.model) {
    conditions.push(ilike(vehicles.model, `%${input.model}%`));
  }

  if (input.fuelType) {
    conditions.push(ilike(vehicles.fuelType, `%${input.fuelType}%`));
  }

  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(
      or(
        ilike(vehicles.make, term),
        ilike(vehicles.model, term),
        ilike(vehicles.variant, term),
        ilike(vehicles.vin, term),
        ilike(vehicles.internalNumber, term),
        ilike(vehicles.licensePlate, term)
      )!
    );
  }

  if (input.priceMin !== undefined) {
    conditions.push(gte(sql`CAST(${vehicles.askingPriceGross} AS NUMERIC)`, input.priceMin));
  }

  if (input.priceMax !== undefined) {
    conditions.push(lte(sql`CAST(${vehicles.askingPriceGross} AS NUMERIC)`, input.priceMax));
  }

  if (input.mileageMin !== undefined) {
    conditions.push(gte(vehicles.mileageKm, input.mileageMin));
  }

  if (input.mileageMax !== undefined) {
    conditions.push(lte(vehicles.mileageKm, input.mileageMax));
  }

  if (input.yearMin !== undefined) {
    conditions.push(gte(vehicles.modelYear, input.yearMin));
  }

  if (input.yearMax !== undefined) {
    conditions.push(lte(vehicles.modelYear, input.yearMax));
  }

  // Cursor decoding — compound (sortFieldValue, id)
  if (input.cursor) {
    try {
      const [_cursorSortValue, cursorId] = JSON.parse(
        Buffer.from(input.cursor, "base64url").toString()
      ) as [unknown, string];
      // Simple id-based pagination fallback (proper compound cursor requires dynamic SQL)
      conditions.push(sql`${vehicles.id} != ${cursorId}`);
    } catch {
      // Invalid cursor — ignore and start from beginning
    }
  }

  // Build sort
  const sortDir = input.sortOrder === "asc" ? asc : desc;
  let orderBy;
  switch (input.sortBy) {
    case "asking_price_gross":
      orderBy = [sortDir(sql`CAST(${vehicles.askingPriceGross} AS NUMERIC)`), desc(vehicles.id)];
      break;
    case "in_stock_since":
      orderBy = [sortDir(vehicles.inStockSince), desc(vehicles.id)];
      break;
    case "mileage_km":
      orderBy = [sortDir(vehicles.mileageKm), desc(vehicles.id)];
      break;
    case "make":
      orderBy = [sortDir(vehicles.make), desc(vehicles.id)];
      break;
    default:
      orderBy = [sortDir(vehicles.createdAt), desc(vehicles.id)];
  }

  const rows = await ctx.db
    .select()
    .from(vehicles)
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(fetchLimit);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Resolve main photo for each vehicle (batched by vehicleId)
  const vehicleIds = items.map((r) => r.id);
  const photoRows = vehicleIds.length > 0
    ? await ctx.db
        .select({
          entityId: files.entityId,
          storagePath: files.storagePath,
          position: files.position,
        })
        .from(files)
        .where(
          and(
            eq(files.entityType, "vehicle"),
            inArray(files.entityId, vehicleIds),
            isNull(files.deletedAt),
            eq(files.kind, "thumbnail_list")
          )
        )
        .orderBy(asc(files.position))
    : [];

  // Build a map: vehicleId → first thumbnail URL
  const mainPhotoMap = new Map<string, string>();
  for (const pr of photoRows) {
    if (pr.entityId && !mainPhotoMap.has(pr.entityId)) {
      mainPhotoMap.set(pr.entityId, storageUrl(pr.storagePath));
    }
  }

  const listItems: VehicleListItem[] = items.map((r) => ({
    id: r.id,
    make: r.make,
    model: r.model,
    variant: r.variant ?? null,
    askingPriceGross: r.askingPriceGross ?? null,
    taxType: r.taxType,
    status: r.status,
    published: r.published,
    featured: r.featured,
    daysInStock: calcDaysInStock(r.inStockSince, r.status),
    inStockSince: r.inStockSince ?? null,
    mileageKm: r.mileageKm ?? null,
    fuelType: r.fuelType ?? null,
    firstRegistration: r.firstRegistration ?? null,
    bodyType: r.bodyType ?? null,
    colorExterior: r.colorExterior ?? null,
    mainPhotoUrl: mainPhotoMap.get(r.id) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1]!;
    const cursorData = JSON.stringify([last.createdAt.toISOString(), last.id]);
    nextCursor = Buffer.from(cursorData).toString("base64url");
  }

  return { items: listItems, nextCursor };
}

// ---------------------------------------------------------------------------
// getById
// ---------------------------------------------------------------------------

export async function getById(
  id: string,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  const [record] = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!record) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const [photos, daysInStock] = await Promise.all([
    resolvePhotos(id, ctx.db),
    Promise.resolve(calcDaysInStock(record.inStockSince, record.status)),
  ]);

  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(record, photos, daysInStock, canSeePrices);
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export async function create(
  input: CreateVehicleInput,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  // VIN decode — synchronous, fallback to null if DAT unavailable
  let datResult: VinDecodingResult | null = null;
  if (input.vin) {
    datResult = await datDecodeVin(input.vin);
  }

  // Merge DAT results into input — only fill empty fields
  const merged = { ...input };
  if (datResult) {
    if (!merged.make && datResult.make) merged.make = datResult.make;
    if (!merged.model && datResult.model) merged.model = datResult.model;
    if (!merged.variant && datResult.variant) merged.variant = datResult.variant;
    if (!merged.bodyType && datResult.bodyType) merged.bodyType = datResult.bodyType;
    if (!merged.fuelType && datResult.fuelType) merged.fuelType = datResult.fuelType;
    if (!merged.transmission && datResult.transmission) merged.transmission = datResult.transmission;
    if (!merged.driveType && datResult.driveType) merged.driveType = datResult.driveType;
    if (!merged.engineSizeCcm && datResult.engineSizeCcm) merged.engineSizeCcm = datResult.engineSizeCcm;
    if (!merged.powerKw && datResult.powerKw) merged.powerKw = datResult.powerKw;
    if (!merged.powerPs && datResult.powerPs) merged.powerPs = datResult.powerPs;
    if (!merged.doors && datResult.doors) merged.doors = datResult.doors;
    if (!merged.seats && datResult.seats) merged.seats = datResult.seats;
    if (!merged.emissionClass && datResult.emissionClass) merged.emissionClass = datResult.emissionClass;
    if (!merged.co2Emissions && datResult.co2Emissions) merged.co2Emissions = datResult.co2Emissions;
    if (!merged.fuelConsumption && datResult.fuelConsumption) merged.fuelConsumption = datResult.fuelConsumption;
    if (datResult.equipmentCodes?.length && !merged.equipmentCodes?.length) {
      merged.equipmentCodes = datResult.equipmentCodes;
    }
  }

  // Calculate powerPs from powerKw if only one is given
  if (merged.powerKw && !merged.powerPs) {
    merged.powerPs = Math.round(merged.powerKw * 1.35962);
  } else if (merged.powerPs && !merged.powerKw) {
    merged.powerKw = Math.round(merged.powerPs / 1.35962);
  }

  const today = new Date().toISOString().split("T")[0]!;

  const [record] = await ctx.db
    .insert(vehicles)
    .values({
      tenantId: ctx.tenantId,
      vin: merged.vin ?? null,
      internalNumber: merged.internalNumber ?? null,
      licensePlate: merged.licensePlate ?? null,
      make: merged.make,
      model: merged.model,
      variant: merged.variant ?? null,
      modelYear: merged.modelYear ?? null,
      firstRegistration: merged.firstRegistration ?? null,
      bodyType: merged.bodyType ?? null,
      fuelType: merged.fuelType ?? null,
      transmission: merged.transmission ?? null,
      driveType: merged.driveType ?? null,
      engineSizeCcm: merged.engineSizeCcm ?? null,
      powerKw: merged.powerKw ?? null,
      powerPs: merged.powerPs ?? null,
      doors: merged.doors ?? null,
      seats: merged.seats ?? null,
      colorExterior: merged.colorExterior ?? null,
      colorInterior: merged.colorInterior ?? null,
      emissionClass: merged.emissionClass ?? null,
      co2Emissions: merged.co2Emissions ?? null,
      fuelConsumption: merged.fuelConsumption ?? null,
      electricRangeKm: merged.electricRangeKm ?? null,
      batteryCapacityKwh: merged.batteryCapacityKwh ?? null,
      mileageKm: merged.mileageKm ?? null,
      condition: merged.condition ?? null,
      previousOwners: merged.previousOwners ?? null,
      huValidUntil: merged.huValidUntil ?? null,
      accidentFree: merged.accidentFree ?? null,
      nonSmoker: merged.nonSmoker ?? null,
      equipment: merged.equipment ?? [],
      equipmentCodes: merged.equipmentCodes ?? [],
      purchasePriceNet: merged.purchasePriceNet ?? null,
      askingPriceGross: merged.askingPriceGross ?? null,
      minimumPriceGross: merged.minimumPriceGross ?? null,
      taxType: merged.taxType ?? "margin",
      title: merged.title ?? null,
      description: merged.description ?? null,
      internalNotes: merged.internalNotes ?? null,
      status: "draft",
      published: false,
      featured: false,
      inStockSince: merged.inStockSince ?? today,
      source: merged.source ?? "manual",
      sourceReference: merged.sourceReference ?? null,
      createdBy: ctx.userId,
    })
    .returning();

  if (!record) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  // Queue VIN decode retry if DAT was unavailable
  if (input.vin && !datResult) {
    await queueVinDecodeRetry(record.id, input.vin, ctx.tenantId, ctx.db).catch(() => {});
  }

  await writeAuditLog(ctx, "create_vehicle", "vehicle", record.id, ctx.db);

  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(record, [], null, canSeePrices);
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export async function update(
  input: UpdateVehicleInput,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  const { id, ...updates } = input;

  const [current] = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // VIN changed → trigger new DAT decode
  let datResult: VinDecodingResult | null = null;
  if (updates.vin && updates.vin !== current.vin) {
    datResult = await datDecodeVin(updates.vin);
  }

  // Calculate powerPs/powerKw if only one is given in the update
  if (updates.powerKw && !updates.powerPs && !current.powerPs) {
    updates.powerPs = Math.round(updates.powerKw * 1.35962);
  } else if (updates.powerPs && !updates.powerKw && !current.powerKw) {
    updates.powerKw = Math.round(updates.powerPs / 1.35962);
  }

  const oldPrice = current.askingPriceGross;
  const newPrice = updates.askingPriceGross;
  const priceChanged = newPrice !== undefined && newPrice !== oldPrice;

  const [updated] = await ctx.db
    .update(vehicles)
    .set({
      ...Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined)
      ),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  if (priceChanged) {
    await writeAuditLog(ctx, `price_change:${oldPrice}→${newPrice}`, "vehicle", id, ctx.db);
  } else {
    await writeAuditLog(ctx, "update_vehicle", "vehicle", id, ctx.db);
  }

  // Queue VIN decode retry if VIN changed but DAT unavailable
  if (updates.vin && !datResult) {
    await queueVinDecodeRetry(id, updates.vin, ctx.tenantId, ctx.db).catch(() => {});
  }

  const [photos, daysInStock] = await Promise.all([
    resolvePhotos(id, ctx.db),
    Promise.resolve(calcDaysInStock(updated.inStockSince, updated.status)),
  ]);

  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(updated, photos, daysInStock, canSeePrices);
}

// ---------------------------------------------------------------------------
// updateStatus
// ---------------------------------------------------------------------------

export async function updateStatus(
  input: UpdateVehicleStatusInput,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  const [current] = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, input.id),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const allowed = STATUS_TRANSITIONS[current.status] as readonly VehicleStatus[];
  if (!allowed.includes(input.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Übergang von "${current.status}" nach "${input.status}" ist nicht erlaubt.`,
    });
  }

  // Reservation requires a contact ID
  if (input.status === "reserved" && !input.reservedForContactId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Für eine Reservierung muss ein Kontakt angegeben werden.",
    });
  }

  const now = new Date();
  const isPublishable = (PUBLISHABLE_STATUSES as readonly string[]).includes(input.status);
  const wasPublished = current.published;
  const shouldUnpublish = wasPublished && !isPublishable;

  const statusUpdates: Partial<typeof vehicles.$inferInsert> = {
    status: input.status,
    updatedAt: now,
  };

  if (input.status === "reserved") {
    statusUpdates.reservedForContactId = input.reservedForContactId;
    statusUpdates.reservedAt = now;
  }

  if (current.status === "reserved" && input.status !== "reserved") {
    statusUpdates.reservedForContactId = null;
    statusUpdates.reservedAt = null;
  }

  if (input.status === "sold") {
    statusUpdates.soldAt = now;
  }

  if (input.status === "delivered") {
    statusUpdates.deliveredAt = now;
  }

  if (shouldUnpublish) {
    statusUpdates.published = false;
  }

  const [updated] = await ctx.db
    .update(vehicles)
    .set(statusUpdates)
    .where(
      and(
        eq(vehicles.id, input.id),
        eq(vehicles.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  if (shouldUnpublish) {
    await deletePublicDerivatives(input.id, ctx.tenantId);
    await triggerPublicRevalidation(ctx.tenantId);
  }

  await writeAuditLog(ctx, `status_change:${current.status}→${input.status}`, "vehicle", input.id, ctx.db);

  const [photos, daysInStock] = await Promise.all([
    resolvePhotos(input.id, ctx.db),
    Promise.resolve(calcDaysInStock(updated.inStockSince, updated.status)),
  ]);

  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(updated, photos, daysInStock, canSeePrices);
}

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

export async function publish(
  id: string,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  const [current] = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // Publish rules (spec: 12.2)
  if (!(PUBLISHABLE_STATUSES as readonly string[]).includes(current.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nur Fahrzeuge mit Status 'Verfügbar' oder 'Reserviert' können veröffentlicht werden.",
    });
  }

  if (!current.make || !current.model) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Marke und Modell müssen gesetzt sein.",
    });
  }

  if (!current.askingPriceGross || parseFloat(current.askingPriceGross) <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Ein gültiger Verkaufspreis ist erforderlich.",
    });
  }

  // Check for at least one photo
  const [photoCount] = await ctx.db
    .select({ count: sql<number>`count(*)::int` })
    .from(files)
    .where(
      and(
        eq(files.entityType, "vehicle"),
        eq(files.entityId, id),
        isNull(files.deletedAt)
      )
    );

  if (!photoCount || photoCount.count < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Mindestens ein Foto ist erforderlich zum Veröffentlichen.",
    });
  }

  // Mark public photos
  await ctx.db
    .update(files)
    .set({ isPublic: true })
    .where(
      and(
        eq(files.entityType, "vehicle"),
        eq(files.entityId, id),
        isNull(files.deletedAt)
      )
    );

  const [updated] = await ctx.db
    .update(vehicles)
    .set({ published: true, updatedAt: new Date() })
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  await triggerPublicRevalidation(ctx.tenantId);
  await writeAuditLog(ctx, "publish_vehicle", "vehicle", id, ctx.db);

  const [photos, daysInStock] = await Promise.all([
    resolvePhotos(id, ctx.db),
    Promise.resolve(calcDaysInStock(updated.inStockSince, updated.status)),
  ]);

  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(updated, photos, daysInStock, canSeePrices);
}

// ---------------------------------------------------------------------------
// unpublish
// ---------------------------------------------------------------------------

export async function unpublish(
  id: string,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  const [current] = await ctx.db
    .select({ id: vehicles.id, tenantId: vehicles.tenantId, status: vehicles.status, inStockSince: vehicles.inStockSince })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // Mark photos as non-public
  await ctx.db
    .update(files)
    .set({ isPublic: false })
    .where(
      and(
        eq(files.entityType, "vehicle"),
        eq(files.entityId, id),
        isNull(files.deletedAt)
      )
    );

  const [updated] = await ctx.db
    .update(vehicles)
    .set({ published: false, updatedAt: new Date() })
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  await deletePublicDerivatives(id, ctx.tenantId);
  await triggerPublicRevalidation(ctx.tenantId);
  await writeAuditLog(ctx, "unpublish_vehicle", "vehicle", id, ctx.db);

  const [photos, daysInStock] = await Promise.all([
    resolvePhotos(id, ctx.db),
    Promise.resolve(calcDaysInStock(updated.inStockSince, updated.status)),
  ]);

  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(updated, photos, daysInStock, canSeePrices);
}

// ---------------------------------------------------------------------------
// archive
// ---------------------------------------------------------------------------

export async function archive(
  id: string,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  const [current] = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const now = new Date();

  const [updated] = await ctx.db
    .update(vehicles)
    .set({
      status: "archived",
      published: false,
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  if (current.published) {
    await deletePublicDerivatives(id, ctx.tenantId);
    await triggerPublicRevalidation(ctx.tenantId);
  }

  await writeAuditLog(ctx, "archive_vehicle", "vehicle", id, ctx.db);

  const [photos] = await Promise.all([resolvePhotos(id, ctx.db)]);

  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(updated, photos, null, canSeePrices);
}

// ---------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------

export async function restore(
  id: string,
  ctx: TrpcContext
): Promise<VehicleView | VehicleViewRestricted> {
  // Must query including deleted_at IS NOT NULL
  const [current] = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId),
        isNotNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const [updated] = await ctx.db
    .update(vehicles)
    .set({
      status: "draft",
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(vehicles.id, id),
        eq(vehicles.tenantId, ctx.tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  await writeAuditLog(ctx, "restore_vehicle", "vehicle", id, ctx.db);

  const photos = await resolvePhotos(id, ctx.db);
  const canSeePrices = PRICE_VISIBILITY_ROLES.includes(
    ctx.role as (typeof PRICE_VISIBILITY_ROLES)[number]
  );

  return recordToView(updated, photos, null, canSeePrices);
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

export async function getStats(ctx: TrpcContext): Promise<InventoryStats> {
  const rows = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    );

  const byStatus: Record<VehicleStatus, number> = {
    draft: 0,
    in_preparation: 0,
    available: 0,
    reserved: 0,
    sold: 0,
    delivered: 0,
    archived: 0,
  };

  let totalDaysInStock = 0;
  let daysInStockCount = 0;
  let totalPrice = 0;
  let priceCount = 0;
  let langsteherCount = 0;

  for (const r of rows) {
    byStatus[r.status]++;

    const days = calcDaysInStock(r.inStockSince, r.status);
    if (days !== null) {
      totalDaysInStock += days;
      daysInStockCount++;
      if (days > LANGSTEHER_THRESHOLD_DAYS) langsteherCount++;
    }

    if (r.askingPriceGross) {
      const price = parseFloat(r.askingPriceGross);
      if (!isNaN(price)) {
        totalPrice += price;
        priceCount++;
      }
    }
  }

  return {
    total: rows.length,
    byStatus,
    avgDaysInStock: daysInStockCount > 0 ? totalDaysInStock / daysInStockCount : 0,
    avgAskingPrice: priceCount > 0 ? totalPrice / priceCount : 0,
    totalStockValue: totalPrice,
    langsteherCount,
  };
}

// ---------------------------------------------------------------------------
// generateDescription
// ---------------------------------------------------------------------------

export async function generateDescription(
  vehicleId: string,
  ctx: TrpcContext
): Promise<{ title: string; description: string }> {
  const [record] = await ctx.db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!record) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // Load branding for tone/formality/style
  let branding;
  try {
    branding = await getBrandingForTenant(ctx.tenantId, ctx.db);
  } catch {
    branding = null;
  }

  const tone = branding?.tone ?? "professional";
  const formality = branding?.formality ?? "sie";
  const style = branding?.descriptionStyle ?? "balanced";
  const tenantName = branding?.tenantName ?? "Autohaus";

  const vehicleData = {
    make: record.make,
    model: record.model,
    variant: record.variant,
    modelYear: record.modelYear,
    firstRegistration: record.firstRegistration,
    mileageKm: record.mileageKm,
    fuelType: record.fuelType,
    transmission: record.transmission,
    powerKw: record.powerKw,
    powerPs: record.powerPs,
    bodyType: record.bodyType,
    colorExterior: record.colorExterior,
    colorInterior: record.colorInterior,
    condition: record.condition,
    huValidUntil: record.huValidUntil,
    accidentFree: record.accidentFree,
    nonSmoker: record.nonSmoker,
    equipment: record.equipment?.slice(0, 20), // limit to avoid token overflow
    emissionClass: record.emissionClass,
  };

  const raw = await callClaude({
    systemPrompt: `Du schreibst Fahrzeuganzeigen für ${tenantName}.
Ton: ${tone}. Anrede: ${formality === "du" ? "Du-Form" : "Sie-Form"}. Stil: ${style}.
Sprache: Deutsch.
Antworte NUR mit validem JSON ohne Markdown.`,
    userPrompt: `Fahrzeugdaten:
${JSON.stringify(vehicleData, null, 2)}

Aufgabe:
1. Schreibe einen Inserat-Titel (max 80 Zeichen).
   Format: "{Marke} {Modell} {Variante} | {Highlight 1} | {Highlight 2}"
2. Schreibe eine Inserat-Beschreibung (150-300 Wörter).
   - Beginne mit dem stärksten Verkaufsargument
   - Erwähne die wichtigsten Ausstattungs-Highlights
   - Keine erfundenen Daten
   - Keine rechtlichen Aussagen (Garantie, Gewährleistung)

Output:
{ "title": "...", "description": "..." }`,
    maxTokens: 2000,
  });

  const result = parseClaudeJson<{ title: string; description: string }>(raw);

  return {
    title: result.title ?? "",
    description: result.description ?? "",
  };
}

// ---------------------------------------------------------------------------
// decodeVin
// ---------------------------------------------------------------------------

export async function decodeVin(vin: string): Promise<VinDecodingResult | null> {
  return datDecodeVin(vin);
}

// ---------------------------------------------------------------------------
// reorderPhotos
// ---------------------------------------------------------------------------

export async function reorderPhotos(
  vehicleId: string,
  photoIds: string[],
  ctx: TrpcContext
): Promise<FileReference[]> {
  // Verify vehicle belongs to tenant
  const [vehicle] = await ctx.db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!vehicle) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // Update positions
  await Promise.all(
    photoIds.map((photoId, index) =>
      ctx.db
        .update(files)
        .set({ position: index + 1 })
        .where(
          and(
            eq(files.id, photoId),
            eq(files.entityId, vehicleId),
            eq(files.entityType, "vehicle"),
            isNull(files.deletedAt)
          )
        )
    )
  );

  return resolvePhotos(vehicleId, ctx.db);
}

// ---------------------------------------------------------------------------
// deletePhoto
// ---------------------------------------------------------------------------

export async function deletePhoto(
  vehicleId: string,
  photoId: string,
  ctx: TrpcContext
): Promise<void> {
  const [vehicle] = await ctx.db
    .select({ id: vehicles.id, published: vehicles.published })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!vehicle) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  await ctx.db
    .update(files)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(files.id, photoId),
        eq(files.entityId, vehicleId),
        eq(files.entityType, "vehicle"),
        isNull(files.deletedAt)
      )
    );

  // If vehicle is published, trigger revalidation
  if (vehicle.published) {
    await triggerPublicRevalidation(ctx.tenantId);
  }
}

// ---------------------------------------------------------------------------
// bulkUpsertVehicles — for Börsen-Hub (Module 13)
// ---------------------------------------------------------------------------

export async function bulkUpsertVehicles(input: {
  tenantId: string;
  vehicles: BulkUpsertVehicleItem[];
  db: TrpcContext["db"];
}): Promise<BulkUpsertResult> {
  const result: BulkUpsertResult = { created: 0, updated: 0, errors: [] };

  for (const vehicle of input.vehicles) {
    try {
      // Check for existing vehicle by source reference
      const [existing] = await input.db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
          and(
            eq(vehicles.tenantId, input.tenantId),
            eq(vehicles.source, vehicle.source),
            eq(vehicles.sourceReference, vehicle.sourceReference)
          )
        )
        .limit(1);

      if (existing) {
        // Update only empty fields
        await input.db
          .update(vehicles)
          .set({
            make: vehicle.make,
            model: vehicle.model,
            variant: vehicle.variant ?? null,
            mileageKm: vehicle.mileageKm ?? null,
            askingPriceGross: vehicle.askingPriceGross ?? null,
            fuelType: vehicle.fuelType ?? null,
            firstRegistration: vehicle.firstRegistration ?? null,
            updatedAt: new Date(),
          })
          .where(eq(vehicles.id, existing.id));
        result.updated++;
      } else {
        const today = new Date().toISOString().split("T")[0]!;
        await input.db.insert(vehicles).values({
          tenantId: input.tenantId,
          make: vehicle.make,
          model: vehicle.model,
          variant: vehicle.variant ?? null,
          vin: vehicle.vin ?? null,
          mileageKm: vehicle.mileageKm ?? null,
          askingPriceGross: vehicle.askingPriceGross ?? null,
          fuelType: vehicle.fuelType ?? null,
          transmission: vehicle.transmission ?? null,
          firstRegistration: vehicle.firstRegistration ?? null,
          bodyType: vehicle.bodyType ?? null,
          colorExterior: vehicle.colorExterior ?? null,
          equipment: vehicle.equipment ?? [],
          equipmentCodes: vehicle.equipmentCodes ?? [],
          taxType: vehicle.taxType ?? "margin",
          status: "draft",
          published: false,
          featured: false,
          inStockSince: today,
          source: "boersen_import",
          sourceReference: vehicle.sourceReference,
        });
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        sourceReference: vehicle.sourceReference,
        message: (err as Error).message,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Cross-module exports
// ---------------------------------------------------------------------------

/** Called by Sales module (Module 03) when a deal is won */
export async function markVehicleAsSold(
  vehicleId: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<void> {
  const [vehicle] = await db
    .select({ id: vehicles.id, status: vehicles.status, published: vehicles.published })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.tenantId, tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!vehicle) throw new Error(`Vehicle ${vehicleId} not found`);

  if (!["available", "reserved"].includes(vehicle.status)) {
    throw new Error(`Vehicle ${vehicleId} must be available or reserved to mark as sold`);
  }

  const now = new Date();
  await db
    .update(vehicles)
    .set({
      status: "sold",
      published: false,
      soldAt: now,
      reservedForContactId: null,
      reservedAt: null,
      updatedAt: now,
    })
    .where(eq(vehicles.id, vehicleId));

  if (vehicle.published) {
    await deletePublicDerivatives(vehicleId, tenantId);
  }
}

/** Called by Sales module when a deal is lost/cancelled */
export async function releaseVehicleReservation(
  vehicleId: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<void> {
  const [vehicle] = await db
    .select({ id: vehicles.id, status: vehicles.status })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.tenantId, tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!vehicle || vehicle.status !== "reserved") return;

  await db
    .update(vehicles)
    .set({
      status: "available",
      reservedForContactId: null,
      reservedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(vehicles.id, vehicleId));
}

/** Read access for other modules (returns VehicleRecord directly) */
export async function getVehicleById(
  vehicleId: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<VehicleRecord | null> {
  const [record] = await db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.tenantId, tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  return record ?? null;
}

/** Read access for other modules — returns minimal list */
export async function getVehiclesForTenant(
  tenantId: string,
  db: TrpcContext["db"],
  options?: { status?: VehicleStatus[]; limit?: number }
): Promise<VehicleRecord[]> {
  const conditions = [
    eq(vehicles.tenantId, tenantId),
    isNull(vehicles.deletedAt),
  ];

  if (options?.status?.length) {
    conditions.push(inArray(vehicles.status, options.status));
  }

  return db
    .select()
    .from(vehicles)
    .where(and(...conditions))
    .limit(options?.limit ?? 200);
}

/** Public vehicle listing for a tenant slug — uses Service Role */
export async function getPublicVehiclesForSlug(
  slug: string,
  params: {
    cursor?: string;
    limit?: number;
    make?: string;
    fuelType?: string;
    priceMax?: number;
    sort?: "price_asc" | "price_desc" | "newest" | "mileage_asc";
  }
): Promise<{ items: PublicVehicle[]; nextCursor: string | null }> {
  const supabase = createSupabaseServiceClient();
  const limit = params.limit ?? 20;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .in("status", ["active", "trial"])
    .single();

  if (!tenant) return { items: [], nextCursor: null };

  let query = supabase
    .from("vehicles")
    .select("*, files!inner(storage_path, alt_text, position, kind)")
    .eq("tenant_id", tenant.id)
    .eq("published", true)
    .is("deleted_at", null)
    .limit(limit + 1);

  if (params.make) query = query.ilike("make", `%${params.make}%`);
  if (params.fuelType) query = query.ilike("fuel_type", `%${params.fuelType}%`);
  if (params.priceMax) query = query.lte("asking_price_gross", params.priceMax);

  switch (params.sort) {
    case "price_asc": query = query.order("asking_price_gross", { ascending: true }); break;
    case "price_desc": query = query.order("asking_price_gross", { ascending: false }); break;
    case "mileage_asc": query = query.order("mileage_km", { ascending: true }); break;
    default: query = query.order("created_at", { ascending: false });
  }

  const { data: rows } = await query;
  if (!rows) return { items: [], nextCursor: null };

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const publicItems: PublicVehicle[] = items.map((r) => {
    const photoFiles = (r.files as { storage_path: string; alt_text: string | null; position: number; kind: string }[] ?? [])
      .filter((f) => ["photo", "thumbnail_detail"].includes(f.kind))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((f) => ({
        url: storageUrl(f.storage_path),
        altText: f.alt_text ?? null,
        position: f.position ?? 0,
      }));

    return {
      id: r.id as string,
      make: r.make as string,
      model: r.model as string,
      variant: (r.variant as string | null) ?? null,
      firstRegistration: (r.first_registration as string | null) ?? null,
      mileageKm: (r.mileage_km as number | null) ?? null,
      fuelType: (r.fuel_type as string | null) ?? null,
      transmission: (r.transmission as string | null) ?? null,
      powerKw: (r.power_kw as number | null) ?? null,
      powerPs: (r.power_ps as number | null) ?? null,
      colorExterior: (r.color_exterior as string | null) ?? null,
      bodyType: (r.body_type as string | null) ?? null,
      condition: (r.condition as string | null) ?? null,
      askingPriceGross: (r.asking_price_gross as string | null) ?? null,
      taxType: (r.tax_type as string) ?? "margin",
      title: (r.title as string | null) ?? null,
      description: (r.description as string | null) ?? null,
      equipment: (r.equipment as string[]) ?? [],
      huValidUntil: (r.hu_valid_until as string | null) ?? null,
      accidentFree: (r.accident_free as boolean | null) ?? null,
      photos: photoFiles,
      featured: (r.featured as boolean) ?? false,
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1] as Record<string, unknown>;
    nextCursor = Buffer.from(JSON.stringify([last["created_at"], last["id"]])).toString("base64url");
  }

  return { items: publicItems, nextCursor };
}

// ---------------------------------------------------------------------------
// getPublicVehicleById — no auth, service role
// ---------------------------------------------------------------------------

export async function getPublicVehicleById(
  slug: string,
  vehicleId: string
): Promise<PublicVehicle | null> {
  const supabase = createSupabaseServiceClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .in("status", ["active", "trial"])
    .single();

  if (!tenant) return null;

  const { data: r } = await supabase
    .from("vehicles")
    .select("*, files!inner(storage_path, alt_text, position, kind)")
    .eq("id", vehicleId)
    .eq("tenant_id", tenant.id)
    .eq("published", true)
    .is("deleted_at", null)
    .single();

  if (!r) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const storageUrl = (path: string) => `${supabaseUrl}/storage/v1/object/public/${path}`;

  const photoFiles = (r.files as { storage_path: string; alt_text: string | null; position: number; kind: string }[] ?? [])
    .filter((f) => ["photo", "thumbnail_detail"].includes(f.kind))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((f) => ({
      url: storageUrl(f.storage_path),
      altText: f.alt_text ?? null,
      position: f.position ?? 0,
    }));

  return {
    id: r.id as string,
    make: r.make as string,
    model: r.model as string,
    variant: (r.variant as string | null) ?? null,
    firstRegistration: (r.first_registration as string | null) ?? null,
    mileageKm: (r.mileage_km as number | null) ?? null,
    fuelType: (r.fuel_type as string | null) ?? null,
    transmission: (r.transmission as string | null) ?? null,
    powerKw: (r.power_kw as number | null) ?? null,
    powerPs: (r.power_ps as number | null) ?? null,
    colorExterior: (r.color_exterior as string | null) ?? null,
    bodyType: (r.body_type as string | null) ?? null,
    condition: (r.condition as string | null) ?? null,
    askingPriceGross: (r.asking_price_gross as string | null) ?? null,
    taxType: (r.tax_type as string) ?? "margin",
    title: (r.title as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    equipment: (r.equipment as string[]) ?? [],
    huValidUntil: (r.hu_valid_until as string | null) ?? null,
    accidentFree: (r.accident_free as boolean | null) ?? null,
    photos: photoFiles,
    featured: (r.featured as boolean) ?? false,
  };
}
