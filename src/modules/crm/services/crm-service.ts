/**
 * CRM Service — all business logic for contact management.
 *
 * tRPC router is a thin orchestration layer; all real work happens here.
 * Spec: MOD_01
 */

import { eq, and, isNull, isNotNull, inArray, ilike, or, gte, lte, sql, asc, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "@/server/trpc/context";
import { contacts, contactVehicleInterests, contactActivities } from "../db/schema";
import type { ContactRecord } from "../db/schema";
import { vehicles } from "@/modules/inventory";
import { users } from "@/server/db/schema/users";
import { auditLog } from "@/server/db/schema/audit-log";
import {
  CONTACT_TYPE_VALUES,
  CONTACT_SOURCE_VALUES,
  FULL_ACCESS_ROLES,
  DEFAULT_LIST_LIMIT,
  INACTIVITY_THRESHOLD_DAYS,
} from "../domain/constants";
import type {
  ContactView,
  ContactViewRestricted,
  ContactListItem,
  VehicleInterestView,
  ActivityView,
  CrmStats,
  ImportResult,
  ContactType,
  ContactSource,
  ActivityType,
} from "../domain/types";
import type {
  CreateContactInput,
  UpdateContactInput,
  ContactListInput,
  CreateActivityInput,
  GetActivitiesInput,
  AddVehicleInterestInput,
  AssignContactInput,
  ImportContactsInput,
} from "../domain/validators";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalize phone number: remove spaces/dashes, ensure +49 prefix for German numbers */
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  let normalized = phone.replace(/[\s\-\(\)\/]/g, "");
  // If starts with 0 and looks German, add +49
  if (normalized.startsWith("0") && !normalized.startsWith("00")) {
    normalized = "+49" + normalized.slice(1);
  }
  // Convert 0049 to +49
  if (normalized.startsWith("0049")) {
    normalized = "+49" + normalized.slice(4);
  }
  return normalized || null;
}

/** Normalize email: lowercase + trim */
function normalizeEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  return email.toLowerCase().trim() || null;
}

/** Compute display name per spec 4.3 */
function computeDisplayName(
  salutation: string | null,
  firstName: string | null,
  lastName: string | null,
  companyName: string | null
): string {
  if (lastName) {
    const parts = [salutation, firstName, lastName].filter(Boolean);
    return parts.join(" ");
  }
  if (companyName) return companyName;
  return "Unbekannt";
}

/** Check if contact is inactive (no interaction in last 30 days) */
function isInactive(lastInteractionAt: Date | null): boolean {
  if (!lastInteractionAt) return true;
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - INACTIVITY_THRESHOLD_DAYS);
  return lastInteractionAt < threshold;
}

/** Check for duplicate contacts by normalized channels */
async function checkDuplicates(
  tenantId: string,
  email: string | null,
  phone: string | null,
  phoneMobile: string | null,
  whatsappNumber: string | null,
  excludeId: string | null,
  db: TrpcContext["db"]
): Promise<string | null> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(contacts.tenantId, tenantId),
    isNull(contacts.deletedAt),
  ];

  if (excludeId) {
    conditions.push(sql`${contacts.id} != ${excludeId}` as ReturnType<typeof eq>);
  }

  const channelConditions: ReturnType<typeof eq>[] = [];
  if (email) {
    channelConditions.push(sql`lower(${contacts.email}) = ${email}` as ReturnType<typeof eq>);
  }
  if (phone) {
    channelConditions.push(eq(contacts.phone, phone));
  }
  if (phoneMobile) {
    channelConditions.push(eq(contacts.phoneMobile, phoneMobile));
  }
  if (whatsappNumber) {
    channelConditions.push(eq(contacts.whatsappNumber, whatsappNumber));
  }

  if (channelConditions.length === 0) return null;

  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(...conditions, or(...channelConditions)!))
    .limit(1);

  return existing?.id ?? null;
}

/** Resolve assigned user info */
async function resolveUser(
  userId: string | null,
  db: TrpcContext["db"]
): Promise<{ id: string; name: string } | null> {
  if (!userId) return null;
  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ? { id: user.id, name: user.name ?? "" } : null;
}

/** Resolve vehicle interests for a contact */
async function resolveVehicleInterests(
  contactId: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<VehicleInterestView[]> {
  const rows = await db
    .select({
      id: contactVehicleInterests.id,
      vehicleId: contactVehicleInterests.vehicleId,
      interestType: contactVehicleInterests.interestType,
      notes: contactVehicleInterests.notes,
      createdAt: contactVehicleInterests.createdAt,
      make: vehicles.make,
      model: vehicles.model,
    })
    .from(contactVehicleInterests)
    .leftJoin(vehicles, eq(contactVehicleInterests.vehicleId, vehicles.id))
    .where(
      and(
        eq(contactVehicleInterests.contactId, contactId),
        eq(contactVehicleInterests.tenantId, tenantId)
      )
    )
    .orderBy(desc(contactVehicleInterests.createdAt));

  return rows.map((r) => ({
    id: r.id,
    vehicleId: r.vehicleId,
    vehicleLabel: r.make && r.model ? `${r.make} ${r.model}` : "Unbekanntes Fahrzeug",
    interestType: r.interestType as VehicleInterestView["interestType"],
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Resolve recent activities for a contact (last N) */
async function resolveRecentActivities(
  contactId: string,
  tenantId: string,
  limit: number,
  db: TrpcContext["db"]
): Promise<ActivityView[]> {
  const rows = await db
    .select({
      id: contactActivities.id,
      activityType: contactActivities.activityType,
      title: contactActivities.title,
      description: contactActivities.description,
      vehicleId: contactActivities.vehicleId,
      dealId: contactActivities.dealId,
      messageId: contactActivities.messageId,
      performedBy: contactActivities.performedBy,
      performedAt: contactActivities.performedAt,
      createdAt: contactActivities.createdAt,
    })
    .from(contactActivities)
    .where(
      and(
        eq(contactActivities.contactId, contactId),
        eq(contactActivities.tenantId, tenantId)
      )
    )
    .orderBy(desc(contactActivities.performedAt), desc(contactActivities.id))
    .limit(limit);

  // Batch-resolve performer names and vehicle labels
  const performerIds = [...new Set(rows.map((r) => r.performedBy).filter(Boolean))] as string[];
  const vehicleIds = [...new Set(rows.map((r) => r.vehicleId).filter(Boolean))] as string[];

  const performerMap = new Map<string, string>();
  if (performerIds.length > 0) {
    const performers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, performerIds));
    for (const p of performers) {
      performerMap.set(p.id, p.name ?? "");
    }
  }

  const vehicleMap = new Map<string, string>();
  if (vehicleIds.length > 0) {
    const vehicleRows = await db
      .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(inArray(vehicles.id, vehicleIds));
    for (const v of vehicleRows) {
      vehicleMap.set(v.id, `${v.make} ${v.model}`);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    activityType: r.activityType as ActivityView["activityType"],
    title: r.title ?? null,
    description: r.description ?? null,
    vehicleId: r.vehicleId ?? null,
    vehicleLabel: r.vehicleId ? (vehicleMap.get(r.vehicleId) ?? null) : null,
    dealId: r.dealId ?? null,
    messageId: r.messageId ?? null,
    performedBy: r.performedBy
      ? { id: r.performedBy, name: performerMap.get(r.performedBy) ?? "" }
      : null,
    performedAt: r.performedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Writes to audit_log */
async function writeAuditLog(
  ctx: TrpcContext,
  action: string,
  resourceId: string,
  db: TrpcContext["db"]
): Promise<void> {
  await db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action,
    resourceType: "contact",
    resourceId,
  });
}

/** Create an activity and update last_interaction_at */
async function createActivityInternal(
  tenantId: string,
  contactId: string,
  activityType: string,
  title: string | null,
  description: string | null,
  vehicleId: string | null,
  dealId: string | null,
  messageId: string | null,
  performedBy: string | null,
  performedAt: Date,
  db: TrpcContext["db"]
): Promise<void> {
  await db.insert(contactActivities).values({
    tenantId,
    contactId,
    activityType,
    title,
    description,
    vehicleId,
    dealId,
    messageId,
    performedBy,
    performedAt,
  });

  await db
    .update(contacts)
    .set({ lastInteractionAt: performedAt, updatedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)));
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

export async function list(
  input: ContactListInput,
  ctx: TrpcContext
): Promise<{ items: ContactListItem[]; nextCursor: string | null }> {
  const limit = input.limit ?? DEFAULT_LIST_LIMIT;
  const fetchLimit = limit + 1;

  const conditions = [
    eq(contacts.tenantId, ctx.tenantId),
    isNull(contacts.deletedAt),
  ];

  // Type filter
  if (input.contactType) {
    const types = Array.isArray(input.contactType) ? input.contactType : [input.contactType];
    conditions.push(inArray(contacts.contactType, types));
  }

  // Source filter
  if (input.source) {
    const sources = Array.isArray(input.source) ? input.source : [input.source];
    conditions.push(inArray(contacts.source, sources));
  }

  // Tags filter (contact must have ALL specified tags)
  if (input.tags?.length) {
    for (const tag of input.tags) {
      conditions.push(sql`${tag} = ANY(${contacts.tags})` as ReturnType<typeof eq>);
    }
  }

  // Assigned to
  if (input.assignedTo) {
    conditions.push(eq(contacts.assignedTo, input.assignedTo));
  }

  // Inactive filter
  if (input.isInactive !== undefined) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - INACTIVITY_THRESHOLD_DAYS);
    if (input.isInactive) {
      conditions.push(
        or(
          isNull(contacts.lastInteractionAt),
          lte(contacts.lastInteractionAt, threshold)
        )!
      );
    } else {
      conditions.push(gte(contacts.lastInteractionAt, threshold));
    }
  }

  // Search
  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(
      or(
        ilike(contacts.firstName, term),
        ilike(contacts.lastName, term),
        ilike(contacts.email, term),
        ilike(contacts.phone, term),
        ilike(contacts.phoneMobile, term),
        ilike(contacts.whatsappNumber, term),
        ilike(contacts.companyName, term)
      )!
    );
  }

  // Vehicle interest filter (join)
  let useVehicleJoin = false;
  if (input.vehicleId) {
    useVehicleJoin = true;
  }

  // Cursor
  if (input.cursor) {
    try {
      const [, cursorId] = JSON.parse(
        Buffer.from(input.cursor, "base64url").toString()
      ) as [unknown, string];
      conditions.push(sql`${contacts.id} != ${cursorId}` as ReturnType<typeof eq>);
    } catch {
      // Invalid cursor — ignore
    }
  }

  // Sort
  const sortDir = input.sortOrder === "asc" ? asc : desc;
  let orderBy;
  switch (input.sortBy) {
    case "last_name":
      orderBy = [sortDir(contacts.lastName), desc(contacts.id)];
      break;
    case "last_interaction_at":
      orderBy = [sortDir(contacts.lastInteractionAt), desc(contacts.id)];
      break;
    default:
      orderBy = [sortDir(contacts.createdAt), desc(contacts.id)];
  }

  let rows;
  if (useVehicleJoin) {
    rows = await ctx.db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        companyName: contacts.companyName,
        salutation: contacts.salutation,
        contactType: contacts.contactType,
        email: contacts.email,
        phone: contacts.phone,
        tags: contacts.tags,
        assignedTo: contacts.assignedTo,
        lastInteractionAt: contacts.lastInteractionAt,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(
        contactVehicleInterests,
        and(
          eq(contacts.id, contactVehicleInterests.contactId),
          eq(contactVehicleInterests.vehicleId, input.vehicleId!)
        )
      )
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(fetchLimit);
  } else {
    rows = await ctx.db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        companyName: contacts.companyName,
        salutation: contacts.salutation,
        contactType: contacts.contactType,
        email: contacts.email,
        phone: contacts.phone,
        tags: contacts.tags,
        assignedTo: contacts.assignedTo,
        lastInteractionAt: contacts.lastInteractionAt,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(fetchLimit);
  }

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Batch-resolve assigned users
  const assignedIds = [...new Set(items.map((r) => r.assignedTo).filter(Boolean))] as string[];
  const assignedMap = new Map<string, string>();
  if (assignedIds.length > 0) {
    const assignedUsers = await ctx.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, assignedIds));
    for (const u of assignedUsers) {
      assignedMap.set(u.id, u.name ?? "");
    }
  }

  const listItems: ContactListItem[] = items.map((r) => ({
    id: r.id,
    displayName: computeDisplayName(
      r.salutation ?? null,
      r.firstName ?? null,
      r.lastName ?? null,
      r.companyName ?? null
    ),
    contactType: r.contactType as ContactType,
    email: r.email ?? null,
    phone: r.phone ?? null,
    assignedToUser: r.assignedTo
      ? { id: r.assignedTo, name: assignedMap.get(r.assignedTo) ?? "" }
      : null,
    tags: r.tags ?? [],
    isInactive: isInactive(r.lastInteractionAt),
    lastInteractionAt: r.lastInteractionAt?.toISOString() ?? null,
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
): Promise<ContactView | ContactViewRestricted> {
  // viewer role → FORBIDDEN (only list access)
  if (ctx.role === "viewer") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  const [record] = await ctx.db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.tenantId, ctx.tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!record) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const hasFullAccess = FULL_ACCESS_ROLES.includes(
    ctx.role as (typeof FULL_ACCESS_ROLES)[number]
  );

  const [assignedUser, vehicleInterests, recentActivities] = await Promise.all([
    resolveUser(record.assignedTo, ctx.db),
    resolveVehicleInterests(id, ctx.tenantId, ctx.db),
    resolveRecentActivities(id, ctx.tenantId, 5, ctx.db),
  ]);

  const base: ContactView = {
    id: record.id,
    displayName: computeDisplayName(
      record.salutation,
      record.firstName,
      record.lastName,
      record.companyName
    ),
    salutation: record.salutation ?? null,
    firstName: record.firstName ?? null,
    lastName: record.lastName ?? null,
    companyName: record.companyName ?? null,
    email: record.email ?? null,
    phone: record.phone ?? null,
    phoneMobile: record.phoneMobile ?? null,
    whatsappNumber: record.whatsappNumber ?? null,
    street: record.street ?? null,
    zipCode: record.zipCode ?? null,
    city: record.city ?? null,
    country: record.country,
    contactType: record.contactType as ContactType,
    source: record.source as ContactSource,
    tags: record.tags ?? [],
    assignedToUser: assignedUser,
    preferredChannel: record.preferredChannel ?? null,
    language: record.language,
    notes: hasFullAccess ? (record.notes ?? null) : null,
    gdprConsentAt: hasFullAccess ? (record.gdprConsentAt?.toISOString() ?? null) : null,
    gdprConsentSource: hasFullAccess ? (record.gdprConsentSource ?? null) : null,
    marketingConsent: record.marketingConsent,
    vehicleInterests,
    recentActivities,
    isInactive: isInactive(record.lastInteractionAt),
    lastInteractionAt: record.lastInteractionAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };

  if (!hasFullAccess) {
    const { notes: _n, gdprConsentAt: _g, gdprConsentSource: _gs, ...restricted } = base;
    return restricted as ContactViewRestricted;
  }

  return base;
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

export async function create(
  input: CreateContactInput,
  ctx: TrpcContext
): Promise<ContactView | ContactViewRestricted> {
  // Normalize channels
  const normEmail = normalizeEmail(input.email);
  const normPhone = normalizePhone(input.phone);
  const normPhoneMobile = normalizePhone(input.phoneMobile);
  const normWhatsapp = normalizePhone(input.whatsappNumber);

  // Duplicate check
  const duplicateId = await checkDuplicates(
    ctx.tenantId,
    normEmail,
    normPhone,
    normPhoneMobile,
    normWhatsapp,
    null,
    ctx.db
  );

  if (duplicateId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Ein Kontakt mit diesen Kontaktdaten existiert bereits (ID: ${duplicateId}).`,
    });
  }

  const [record] = await ctx.db
    .insert(contacts)
    .values({
      tenantId: ctx.tenantId,
      salutation: input.salutation ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      companyName: input.companyName ?? null,
      email: normEmail,
      phone: normPhone,
      phoneMobile: normPhoneMobile,
      whatsappNumber: normWhatsapp,
      street: input.street ?? null,
      zipCode: input.zipCode ?? null,
      city: input.city ?? null,
      country: input.country ?? "DE",
      contactType: input.contactType ?? "prospect",
      source: input.source ?? "manual",
      tags: input.tags ?? [],
      preferredChannel: input.preferredChannel ?? null,
      notes: input.notes ?? null,
      gdprConsentAt: input.gdprConsentAt ? new Date(input.gdprConsentAt) : null,
      gdprConsentSource: input.gdprConsentSource ?? null,
      marketingConsent: input.marketingConsent ?? false,
      createdBy: ctx.userId,
    })
    .returning();

  if (!record) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  // Create initial activity
  await createActivityInternal(
    ctx.tenantId,
    record.id,
    "type_change",
    "Kontakt erstellt",
    null,
    null,
    null,
    null,
    ctx.userId,
    new Date(),
    ctx.db
  );

  await writeAuditLog(ctx, "create_contact", record.id, ctx.db);

  return getById(record.id, ctx);
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export async function update(
  input: UpdateContactInput,
  ctx: TrpcContext
): Promise<ContactView | ContactViewRestricted> {
  const { id, ...updates } = input;

  const [current] = await ctx.db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.tenantId, ctx.tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // Validate last_name OR company_name still satisfied after update
  const newLastName = updates.lastName !== undefined ? updates.lastName : current.lastName;
  const newCompanyName = updates.companyName !== undefined ? updates.companyName : current.companyName;
  if (!newLastName && !newCompanyName) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nachname oder Firmenname muss angegeben werden.",
    });
  }

  // Normalize changed channels
  const normEmail = updates.email !== undefined ? normalizeEmail(updates.email) : undefined;
  const normPhone = updates.phone !== undefined ? normalizePhone(updates.phone) : undefined;
  const normPhoneMobile = updates.phoneMobile !== undefined ? normalizePhone(updates.phoneMobile) : undefined;
  const normWhatsapp = updates.whatsappNumber !== undefined ? normalizePhone(updates.whatsappNumber) : undefined;

  // Duplicate check on channel changes
  const channelChanged =
    normEmail !== undefined ||
    normPhone !== undefined ||
    normPhoneMobile !== undefined ||
    normWhatsapp !== undefined;

  if (channelChanged) {
    const duplicateId = await checkDuplicates(
      ctx.tenantId,
      normEmail ?? (current.email ? normalizeEmail(current.email) : null),
      normPhone ?? (current.phone ? normalizePhone(current.phone) : null),
      normPhoneMobile ?? (current.phoneMobile ? normalizePhone(current.phoneMobile) : null),
      normWhatsapp ?? (current.whatsappNumber ? normalizePhone(current.whatsappNumber) : null),
      id,
      ctx.db
    );

    if (duplicateId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Ein anderer Kontakt mit diesen Kontaktdaten existiert bereits (ID: ${duplicateId}).`,
      });
    }
  }

  // Build update set — only include defined fields
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.salutation !== undefined) updateSet.salutation = updates.salutation;
  if (updates.firstName !== undefined) updateSet.firstName = updates.firstName;
  if (updates.lastName !== undefined) updateSet.lastName = updates.lastName;
  if (updates.companyName !== undefined) updateSet.companyName = updates.companyName;
  if (normEmail !== undefined) updateSet.email = normEmail;
  if (normPhone !== undefined) updateSet.phone = normPhone;
  if (normPhoneMobile !== undefined) updateSet.phoneMobile = normPhoneMobile;
  if (normWhatsapp !== undefined) updateSet.whatsappNumber = normWhatsapp;
  if (updates.street !== undefined) updateSet.street = updates.street;
  if (updates.zipCode !== undefined) updateSet.zipCode = updates.zipCode;
  if (updates.city !== undefined) updateSet.city = updates.city;
  if (updates.country !== undefined) updateSet.country = updates.country;
  if (updates.contactType !== undefined) updateSet.contactType = updates.contactType;
  if (updates.tags !== undefined) updateSet.tags = updates.tags;
  if (updates.preferredChannel !== undefined) updateSet.preferredChannel = updates.preferredChannel;
  if (updates.language !== undefined) updateSet.language = updates.language;
  if (updates.notes !== undefined) updateSet.notes = updates.notes;
  if (updates.gdprConsentAt !== undefined) {
    updateSet.gdprConsentAt = updates.gdprConsentAt ? new Date(updates.gdprConsentAt) : null;
  }
  if (updates.gdprConsentSource !== undefined) updateSet.gdprConsentSource = updates.gdprConsentSource;
  if (updates.marketingConsent !== undefined) updateSet.marketingConsent = updates.marketingConsent;

  await ctx.db
    .update(contacts)
    .set(updateSet)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)));

  // Type change → create activity
  if (updates.contactType && updates.contactType !== current.contactType) {
    await createActivityInternal(
      ctx.tenantId,
      id,
      "type_change",
      `Typ geändert: ${current.contactType} → ${updates.contactType}`,
      null,
      null,
      null,
      null,
      ctx.userId,
      new Date(),
      ctx.db
    );
  }

  await writeAuditLog(ctx, "update_contact", id, ctx.db);

  return getById(id, ctx);
}

// ---------------------------------------------------------------------------
// archive
// ---------------------------------------------------------------------------

export async function archive(
  id: string,
  ctx: TrpcContext
): Promise<ContactView | ContactViewRestricted> {
  const [current] = await ctx.db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.tenantId, ctx.tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  await ctx.db
    .update(contacts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)));

  await writeAuditLog(ctx, "archive_contact", id, ctx.db);

  // Return the archived contact (need to query with deleted_at)
  const hasFullAccess = FULL_ACCESS_ROLES.includes(
    ctx.role as (typeof FULL_ACCESS_ROLES)[number]
  );
  const [record] = await ctx.db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  if (!record) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

  const assignedUser = await resolveUser(record.assignedTo, ctx.db);
  const base: ContactView = {
    id: record.id,
    displayName: computeDisplayName(record.salutation, record.firstName, record.lastName, record.companyName),
    salutation: record.salutation ?? null,
    firstName: record.firstName ?? null,
    lastName: record.lastName ?? null,
    companyName: record.companyName ?? null,
    email: record.email ?? null,
    phone: record.phone ?? null,
    phoneMobile: record.phoneMobile ?? null,
    whatsappNumber: record.whatsappNumber ?? null,
    street: record.street ?? null,
    zipCode: record.zipCode ?? null,
    city: record.city ?? null,
    country: record.country,
    contactType: record.contactType as ContactType,
    source: record.source as ContactSource,
    tags: record.tags ?? [],
    assignedToUser: assignedUser,
    preferredChannel: record.preferredChannel ?? null,
    language: record.language,
    notes: hasFullAccess ? (record.notes ?? null) : null,
    gdprConsentAt: hasFullAccess ? (record.gdprConsentAt?.toISOString() ?? null) : null,
    gdprConsentSource: hasFullAccess ? (record.gdprConsentSource ?? null) : null,
    marketingConsent: record.marketingConsent,
    vehicleInterests: [],
    recentActivities: [],
    isInactive: isInactive(record.lastInteractionAt),
    lastInteractionAt: record.lastInteractionAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };

  if (!hasFullAccess) {
    const { notes: _n, gdprConsentAt: _g, gdprConsentSource: _gs, ...restricted } = base;
    return restricted as ContactViewRestricted;
  }
  return base;
}

// ---------------------------------------------------------------------------
// restore
// ---------------------------------------------------------------------------

export async function restore(
  id: string,
  ctx: TrpcContext
): Promise<ContactView | ContactViewRestricted> {
  const [current] = await ctx.db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, id),
        eq(contacts.tenantId, ctx.tenantId),
        isNotNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  await ctx.db
    .update(contacts)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, ctx.tenantId)));

  await writeAuditLog(ctx, "restore_contact", id, ctx.db);

  return getById(id, ctx);
}

// ---------------------------------------------------------------------------
// addVehicleInterest
// ---------------------------------------------------------------------------

export async function addVehicleInterest(
  input: AddVehicleInterestInput,
  ctx: TrpcContext
): Promise<VehicleInterestView> {
  // Verify contact exists
  const [contact] = await ctx.db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, input.contactId),
        eq(contacts.tenantId, ctx.tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!contact) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Kontakt nicht gefunden." });
  }

  // Verify vehicle exists in same tenant
  const [vehicle] = await ctx.db
    .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.id, input.vehicleId),
        eq(vehicles.tenantId, ctx.tenantId),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  if (!vehicle) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Fahrzeug nicht gefunden." });
  }

  const [record] = await ctx.db
    .insert(contactVehicleInterests)
    .values({
      tenantId: ctx.tenantId,
      contactId: input.contactId,
      vehicleId: input.vehicleId,
      interestType: input.interestType ?? "inquiry",
      notes: input.notes ?? null,
    })
    .returning();

  if (!record) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  // Create activity + update last_interaction_at
  await createActivityInternal(
    ctx.tenantId,
    input.contactId,
    "vehicle_interest",
    `Interesse an ${vehicle.make} ${vehicle.model}`,
    input.notes ?? null,
    input.vehicleId,
    null,
    null,
    ctx.userId,
    new Date(),
    ctx.db
  );

  return {
    id: record.id,
    vehicleId: record.vehicleId,
    vehicleLabel: `${vehicle.make} ${vehicle.model}`,
    interestType: record.interestType as VehicleInterestView["interestType"],
    notes: record.notes ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// removeVehicleInterest
// ---------------------------------------------------------------------------

export async function removeVehicleInterest(
  contactId: string,
  vehicleId: string,
  ctx: TrpcContext
): Promise<void> {
  await ctx.db
    .delete(contactVehicleInterests)
    .where(
      and(
        eq(contactVehicleInterests.contactId, contactId),
        eq(contactVehicleInterests.vehicleId, vehicleId),
        eq(contactVehicleInterests.tenantId, ctx.tenantId)
      )
    );
}

// ---------------------------------------------------------------------------
// addActivity
// ---------------------------------------------------------------------------

export async function addActivity(
  input: CreateActivityInput,
  ctx: TrpcContext
): Promise<ActivityView> {
  // Verify contact exists
  const [contact] = await ctx.db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, input.contactId),
        eq(contacts.tenantId, ctx.tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!contact) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Kontakt nicht gefunden." });
  }

  const performedAt = input.performedAt ? new Date(input.performedAt) : new Date();

  await createActivityInternal(
    ctx.tenantId,
    input.contactId,
    input.activityType,
    input.title ?? null,
    input.description ?? null,
    input.vehicleId ?? null,
    null, // deal_id — only via service export
    null, // message_id — only via service export
    ctx.userId,
    performedAt,
    ctx.db
  );

  // Return the latest activity
  const activities = await resolveRecentActivities(input.contactId, ctx.tenantId, 1, ctx.db);
  return activities[0]!;
}

// ---------------------------------------------------------------------------
// getActivities
// ---------------------------------------------------------------------------

export async function getActivities(
  input: GetActivitiesInput,
  ctx: TrpcContext
): Promise<{ items: ActivityView[]; nextCursor: string | null }> {
  const limit = input.limit ?? DEFAULT_LIST_LIMIT;
  const fetchLimit = limit + 1;

  const conditions = [
    eq(contactActivities.contactId, input.contactId),
    eq(contactActivities.tenantId, ctx.tenantId),
  ];

  if (input.cursor) {
    try {
      const [, cursorId] = JSON.parse(
        Buffer.from(input.cursor, "base64url").toString()
      ) as [unknown, string];
      conditions.push(sql`${contactActivities.id} != ${cursorId}` as ReturnType<typeof eq>);
    } catch {
      // Invalid cursor
    }
  }

  const rows = await ctx.db
    .select()
    .from(contactActivities)
    .where(and(...conditions))
    .orderBy(desc(contactActivities.performedAt), desc(contactActivities.id))
    .limit(fetchLimit);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Resolve performers and vehicles
  const performerIds = [...new Set(items.map((r) => r.performedBy).filter(Boolean))] as string[];
  const vehicleIds = [...new Set(items.map((r) => r.vehicleId).filter(Boolean))] as string[];

  const performerMap = new Map<string, string>();
  if (performerIds.length > 0) {
    const performers = await ctx.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, performerIds));
    for (const p of performers) performerMap.set(p.id, p.name ?? "");
  }

  const vehicleMap = new Map<string, string>();
  if (vehicleIds.length > 0) {
    const vehicleRows = await ctx.db
      .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(inArray(vehicles.id, vehicleIds));
    for (const v of vehicleRows) vehicleMap.set(v.id, `${v.make} ${v.model}`);
  }

  const activityItems: ActivityView[] = items.map((r) => ({
    id: r.id,
    activityType: r.activityType as ActivityView["activityType"],
    title: r.title ?? null,
    description: r.description ?? null,
    vehicleId: r.vehicleId ?? null,
    vehicleLabel: r.vehicleId ? (vehicleMap.get(r.vehicleId) ?? null) : null,
    dealId: r.dealId ?? null,
    messageId: r.messageId ?? null,
    performedBy: r.performedBy
      ? { id: r.performedBy, name: performerMap.get(r.performedBy) ?? "" }
      : null,
    performedAt: r.performedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1]!;
    nextCursor = Buffer.from(
      JSON.stringify([last.performedAt.toISOString(), last.id])
    ).toString("base64url");
  }

  return { items: activityItems, nextCursor };
}

// ---------------------------------------------------------------------------
// assignContact
// ---------------------------------------------------------------------------

export async function assignContact(
  input: AssignContactInput,
  ctx: TrpcContext
): Promise<ContactView | ContactViewRestricted> {
  const [current] = await ctx.db
    .select({ id: contacts.id, assignedTo: contacts.assignedTo })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, input.contactId),
        eq(contacts.tenantId, ctx.tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  // Verify assignee is in same tenant
  if (input.assignToUserId) {
    const [assignee] = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.id, input.assignToUserId), eq(users.tenantId, ctx.tenantId))
      )
      .limit(1);

    if (!assignee) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Der zugewiesene Mitarbeiter gehört nicht zum selben Autohaus.",
      });
    }
  }

  await ctx.db
    .update(contacts)
    .set({
      assignedTo: input.assignToUserId,
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, input.contactId), eq(contacts.tenantId, ctx.tenantId)));

  // Create assignment change activity
  await createActivityInternal(
    ctx.tenantId,
    input.contactId,
    "assignment_change",
    input.assignToUserId ? "Zuständigkeit zugewiesen" : "Zuständigkeit aufgehoben",
    null,
    null,
    null,
    null,
    ctx.userId,
    new Date(),
    ctx.db
  );

  await writeAuditLog(ctx, "assign_contact", input.contactId, ctx.db);

  return getById(input.contactId, ctx);
}

// ---------------------------------------------------------------------------
// importContacts
// ---------------------------------------------------------------------------

export async function importContacts(
  input: ImportContactsInput,
  ctx: TrpcContext
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < input.contacts.length; i++) {
    const contactInput = input.contacts[i]!;

    // Validate last_name OR company_name
    if (!contactInput.lastName && !contactInput.companyName) {
      result.errors.push({
        index: i,
        message: "Nachname oder Firmenname muss angegeben werden.",
      });
      continue;
    }

    const normEmail = normalizeEmail(contactInput.email);
    const normPhone = normalizePhone(contactInput.phone);
    const normPhoneMobile = normalizePhone(contactInput.phoneMobile);
    const normWhatsapp = normalizePhone(contactInput.whatsappNumber);

    // Duplicate check
    const duplicateId = await checkDuplicates(
      ctx.tenantId,
      normEmail,
      normPhone,
      normPhoneMobile,
      normWhatsapp,
      null,
      ctx.db
    );

    if (duplicateId) {
      if (input.skipDuplicates) {
        result.skipped++;
        continue;
      }
      result.errors.push({ index: i, message: `Duplikat (ID: ${duplicateId})` });
      continue;
    }

    try {
      await ctx.db.insert(contacts).values({
        tenantId: ctx.tenantId,
        salutation: contactInput.salutation ?? null,
        firstName: contactInput.firstName ?? null,
        lastName: contactInput.lastName ?? null,
        companyName: contactInput.companyName ?? null,
        email: normEmail,
        phone: normPhone,
        phoneMobile: normPhoneMobile,
        whatsappNumber: normWhatsapp,
        street: contactInput.street ?? null,
        zipCode: contactInput.zipCode ?? null,
        city: contactInput.city ?? null,
        country: contactInput.country ?? "DE",
        contactType: contactInput.contactType ?? "prospect",
        source: "csv_import",
        tags: contactInput.tags ?? [],
        preferredChannel: contactInput.preferredChannel ?? null,
        marketingConsent: contactInput.marketingConsent ?? false,
        // GDPR: null on import — dealer must actively mark
        createdBy: ctx.userId,
      });
      result.created++;
    } catch (err) {
      result.errors.push({ index: i, message: (err as Error).message });
    }
  }

  await writeAuditLog(ctx, `import_contacts:${result.created}`, "batch", ctx.db);

  return result;
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

export async function getStats(ctx: TrpcContext): Promise<CrmStats> {
  const rows = await ctx.db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.tenantId, ctx.tenantId), isNull(contacts.deletedAt))
    );

  const byType: Record<ContactType, number> = {
    customer: 0,
    prospect: 0,
    seller: 0,
    partner: 0,
    other: 0,
  };

  const bySource: Record<ContactSource, number> = {
    manual: 0,
    csv_import: 0,
    whatsapp: 0,
    mobile_de: 0,
    autoscout24: 0,
    website: 0,
    phone: 0,
    walk_in: 0,
    referral: 0,
    meta_ads: 0,
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inactivityThreshold = new Date();
  inactivityThreshold.setDate(inactivityThreshold.getDate() - INACTIVITY_THRESHOLD_DAYS);

  let newThisMonth = 0;
  let unassigned = 0;
  let inactiveCount = 0;

  for (const r of rows) {
    if (r.contactType in byType) {
      byType[r.contactType as ContactType]++;
    }
    if (r.source in bySource) {
      bySource[r.source as ContactSource]++;
    }
    if (r.createdAt >= monthStart) newThisMonth++;
    if (!r.assignedTo) unassigned++;
    if (isInactive(r.lastInteractionAt)) inactiveCount++;
  }

  return {
    totalContacts: rows.length,
    byType,
    bySource,
    newThisMonth,
    unassigned,
    inactiveCount,
  };
}

// ===========================================================================
// Cross-module service exports
// ===========================================================================

/** Find contact by phone (normalized) */
export async function findContactByPhone(
  phone: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<ContactRecord | null> {
  const norm = normalizePhone(phone);
  if (!norm) return null;

  const [record] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        isNull(contacts.deletedAt),
        eq(contacts.phone, norm)
      )
    )
    .limit(1);

  return record ?? null;
}

/** Find contact by phone_mobile (normalized) */
export async function findContactByPhoneMobile(
  phoneMobile: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<ContactRecord | null> {
  const norm = normalizePhone(phoneMobile);
  if (!norm) return null;

  const [record] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        isNull(contacts.deletedAt),
        eq(contacts.phoneMobile, norm)
      )
    )
    .limit(1);

  return record ?? null;
}

/** Find contact by email (normalized) */
export async function findContactByEmail(
  email: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<ContactRecord | null> {
  const norm = normalizeEmail(email);
  if (!norm) return null;

  const [record] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        isNull(contacts.deletedAt),
        sql`lower(${contacts.email}) = ${norm}`
      )
    )
    .limit(1);

  return record ?? null;
}

/** Find contact by WhatsApp number (normalized) */
export async function findContactByWhatsApp(
  whatsappNumber: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<ContactRecord | null> {
  const norm = normalizePhone(whatsappNumber);
  if (!norm) return null;

  const [record] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.tenantId, tenantId),
        isNull(contacts.deletedAt),
        eq(contacts.whatsappNumber, norm)
      )
    )
    .limit(1);

  return record ?? null;
}

/** Get contact by ID — cross-module read access */
export async function getContactById(
  contactId: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<ContactRecord | null> {
  const [record] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.tenantId, tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  return record ?? null;
}

/**
 * Create contact from external source (WhatsApp, Börsen, Website).
 * Returns existing contact if duplicate found (created: false).
 * Spec: MOD_01 Section 7
 */
export async function createContactFromExternal(
  input: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    phoneMobile?: string;
    whatsappNumber?: string;
    source: ContactSource;
    initialActivity?: {
      activityType: ActivityType;
      title: string;
      description?: string;
      vehicleId?: string;
      messageId?: string;
    };
  },
  tenantId: string,
  db: TrpcContext["db"]
): Promise<{ contact: ContactRecord; created: boolean }> {
  const normEmail = normalizeEmail(input.email);
  const normPhone = normalizePhone(input.phone);
  const normPhoneMobile = normalizePhone(input.phoneMobile);
  const normWhatsapp = normalizePhone(input.whatsappNumber);

  // Check for existing contact
  const duplicateId = await checkDuplicates(
    tenantId, normEmail, normPhone, normPhoneMobile, normWhatsapp, null, db
  );

  if (duplicateId) {
    const existing = await getContactById(duplicateId, tenantId, db);
    if (existing) {
      // Still create the activity for the existing contact
      if (input.initialActivity) {
        await createActivityInternal(
          tenantId,
          existing.id,
          input.initialActivity.activityType,
          input.initialActivity.title,
          input.initialActivity.description ?? null,
          input.initialActivity.vehicleId ?? null,
          null,
          input.initialActivity.messageId ?? null,
          null, // system
          new Date(),
          db
        );
      }
      return { contact: existing, created: false };
    }
  }

  const [record] = await db
    .insert(contacts)
    .values({
      tenantId,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      companyName: input.companyName ?? null,
      email: normEmail,
      phone: normPhone,
      phoneMobile: normPhoneMobile,
      whatsappNumber: normWhatsapp,
      contactType: "prospect",
      source: input.source,
      country: "DE",
      language: "de",
      tags: [],
      marketingConsent: false,
    })
    .returning();

  if (!record) throw new Error("Failed to create contact");

  if (input.initialActivity) {
    await createActivityInternal(
      tenantId,
      record.id,
      input.initialActivity.activityType,
      input.initialActivity.title,
      input.initialActivity.description ?? null,
      input.initialActivity.vehicleId ?? null,
      null,
      input.initialActivity.messageId ?? null,
      null, // system
      new Date(),
      db
    );
  }

  return { contact: record, created: true };
}

/**
 * Add activity for a contact — extended version with deal_id and message_id.
 * Only available via service export, not via tRPC.
 * Spec: MOD_01 Section 7
 */
export async function addActivityForContact(
  input: {
    contactId: string;
    activityType: ActivityType;
    title?: string;
    description?: string;
    vehicleId?: string;
    dealId?: string;
    messageId?: string;
    performedBy?: string;
  },
  tenantId: string,
  db: TrpcContext["db"]
): Promise<void> {
  await createActivityInternal(
    tenantId,
    input.contactId,
    input.activityType,
    input.title ?? null,
    input.description ?? null,
    input.vehicleId ?? null,
    input.dealId ?? null,
    input.messageId ?? null,
    input.performedBy ?? null,
    new Date(),
    db
  );
}

/**
 * Mark contact as customer — called by Sales module on deal won.
 * Spec: MOD_01 Section 7
 */
export async function markContactAsCustomer(
  contactId: string,
  tenantId: string,
  db: TrpcContext["db"]
): Promise<void> {
  const [current] = await db
    .select({ id: contacts.id, contactType: contacts.contactType })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.tenantId, tenantId),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1);

  if (!current) return;

  if (current.contactType === "customer") return;

  await db
    .update(contacts)
    .set({ contactType: "customer", updatedAt: new Date() })
    .where(eq(contacts.id, contactId));

  await createActivityInternal(
    tenantId,
    contactId,
    "type_change",
    `Typ geändert: ${current.contactType} → customer`,
    "Automatisch durch Verkaufsabschluss",
    null,
    null,
    null,
    null, // system
    new Date(),
    db
  );
}
