/**
 * Website Builder Service — all business logic.
 *
 * tRPC router is a thin orchestration layer; all real work happens here.
 * Spec: MOD_11
 */

import { eq, and, desc, gt, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { revalidatePath } from "next/cache";
import type { TrpcContext } from "@/server/trpc/context";
import { websiteSettings, websiteContactSubmissions } from "../db/schema";
import type { WebsiteSettingsRecord } from "../db/schema";
import { vehicles } from "@/modules/inventory";
import { tenants } from "@/server/db/schema/tenants";
import { tenantBranding } from "@/modules/dna-engine/db/schema";
import { createContactFromExternal, addActivityForContact } from "@/modules/crm";
import { auditLog } from "@/server/db/schema/audit-log";
import type {
  WebsiteSettingsView,
  SubmissionView,
  PublicWebsiteSettings,
  PublishGateResult,
} from "../domain/types";
import type {
  UpdateWebsiteSettingsInput,
  ListSubmissionsInput,
  ProcessSubmissionInput,
} from "../domain/validators";
import { DEFAULT_HERO_CTA_TEXT, DEFAULT_HERO_HEADLINE } from "../domain/constants";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function recordToView(record: WebsiteSettingsRecord): WebsiteSettingsView {
  return {
    id: record.id,
    isPublished: record.isPublished,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    heroHeadline: record.heroHeadline,
    heroSubheadline: record.heroSubheadline,
    heroCtatext: record.heroCtatext,
    aboutText: record.aboutText,
    contactFormEnabled: record.contactFormEnabled,
    contactFormRecipients: record.contactFormRecipients,
    metaTitle: record.metaTitle,
    metaDescription: record.metaDescription,
    googleAnalyticsId: record.googleAnalyticsId,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

/** Upserts website_settings row and returns it. Creates with defaults if not exists. */
async function upsertDefaults(tenantId: string, db: TrpcContext["db"]): Promise<WebsiteSettingsRecord> {
  const existing = await db
    .select()
    .from(websiteSettings)
    .where(eq(websiteSettings.tenantId, tenantId))
    .limit(1)
    .then((r) => r[0]);

  if (existing) return existing;

  const [created] = await db
    .insert(websiteSettings)
    .values({ tenantId })
    .returning();

  return created!;
}

/** Triggers ISR on-demand revalidation for all portal pages of this tenant. */
async function revalidatePortal(tenantSlug: string): Promise<void> {
  try {
    // Revalidate all portal pages for this tenant
    revalidatePath(`/${tenantSlug}`, "layout");
  } catch {
    // Revalidation is non-blocking — do not throw
  }
}

/** Looks up the tenant slug for revalidation. */
async function getTenantSlug(tenantId: string, db: TrpcContext["db"]): Promise<string | null> {
  const [row] = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row?.slug ?? null;
}

// ---------------------------------------------------------------------------
// getSettings
// ---------------------------------------------------------------------------

export async function getSettings(ctx: TrpcContext): Promise<WebsiteSettingsView> {
  const record = await upsertDefaults(ctx.tenantId, ctx.db);
  return recordToView(record);
}

// ---------------------------------------------------------------------------
// updateSettings
// ---------------------------------------------------------------------------

export async function updateSettings(
  input: UpdateWebsiteSettingsInput,
  ctx: TrpcContext
): Promise<WebsiteSettingsView> {
  await upsertDefaults(ctx.tenantId, ctx.db);

  const [updated] = await ctx.db
    .update(websiteSettings)
    .set({
      ...("heroHeadline" in input && { heroHeadline: input.heroHeadline }),
      ...("heroSubheadline" in input && { heroSubheadline: input.heroSubheadline }),
      ...("heroCtatext" in input && { heroCtatext: input.heroCtatext }),
      ...("aboutText" in input && { aboutText: input.aboutText }),
      ...("contactFormEnabled" in input && { contactFormEnabled: input.contactFormEnabled }),
      ...("contactFormRecipients" in input && { contactFormRecipients: input.contactFormRecipients }),
      ...("metaTitle" in input && { metaTitle: input.metaTitle }),
      ...("metaDescription" in input && { metaDescription: input.metaDescription }),
      ...("googleAnalyticsId" in input && { googleAnalyticsId: input.googleAnalyticsId }),
      updatedAt: new Date(),
    })
    .where(eq(websiteSettings.tenantId, ctx.tenantId))
    .returning();

  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "website.updateSettings",
    resourceType: "website_settings",
    resourceId: updated.id,
  });

  // Trigger ISR revalidation
  const slug = await getTenantSlug(ctx.tenantId, ctx.db);
  if (slug) await revalidatePortal(slug);

  return recordToView(updated);
}

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

export async function publish(ctx: TrpcContext): Promise<WebsiteSettingsView> {
  // Check publish gate
  const gate = await checkPublishGate(ctx);
  if (!gate.canPublish) {
    const missing: string[] = [];
    if (!gate.checks.brandingComplete) missing.push("Branding-Profil nicht vollständig");
    if (!gate.checks.hasPublishedVehicle) missing.push("Kein veröffentlichtes Fahrzeug vorhanden");
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Website kann nicht veröffentlicht werden: ${missing.join(", ")}`,
    });
  }

  await upsertDefaults(ctx.tenantId, ctx.db);

  const [updated] = await ctx.db
    .update(websiteSettings)
    .set({ isPublished: true, publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(websiteSettings.tenantId, ctx.tenantId))
    .returning();

  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "website.publish",
    resourceType: "website_settings",
    resourceId: updated.id,
  });

  const slug = await getTenantSlug(ctx.tenantId, ctx.db);
  if (slug) await revalidatePortal(slug);

  return recordToView(updated);
}

// ---------------------------------------------------------------------------
// unpublish
// ---------------------------------------------------------------------------

export async function unpublish(ctx: TrpcContext): Promise<WebsiteSettingsView> {
  await upsertDefaults(ctx.tenantId, ctx.db);

  const [updated] = await ctx.db
    .update(websiteSettings)
    .set({ isPublished: false, updatedAt: new Date() })
    .where(eq(websiteSettings.tenantId, ctx.tenantId))
    .returning();

  if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "website.unpublish",
    resourceType: "website_settings",
    resourceId: updated.id,
  });

  const slug = await getTenantSlug(ctx.tenantId, ctx.db);
  if (slug) await revalidatePortal(slug);

  return recordToView(updated);
}

// ---------------------------------------------------------------------------
// checkPublishGate
// ---------------------------------------------------------------------------

export async function checkPublishGate(ctx: TrpcContext): Promise<PublishGateResult> {
  const [brandingRow] = await ctx.db
    .select({ completeness: tenantBranding.completeness })
    .from(tenantBranding)
    .where(eq(tenantBranding.tenantId, ctx.tenantId))
    .limit(1);

  const brandingComplete = brandingRow?.completeness === "publish_ready";

  const [vehicleRow] = await ctx.db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(
      and(
        eq(vehicles.tenantId, ctx.tenantId),
        eq(vehicles.published, true),
        isNull(vehicles.deletedAt)
      )
    )
    .limit(1);

  const hasPublishedVehicle = !!vehicleRow;

  return {
    canPublish: brandingComplete && hasPublishedVehicle,
    checks: { brandingComplete, hasPublishedVehicle },
  };
}

// ---------------------------------------------------------------------------
// listSubmissions
// ---------------------------------------------------------------------------

export async function listSubmissions(
  input: ListSubmissionsInput,
  ctx: TrpcContext
): Promise<{ items: SubmissionView[]; nextCursor: string | null }> {
  const limit = input.limit;
  const conditions = [eq(websiteContactSubmissions.tenantId, ctx.tenantId)];

  if (input.processed !== undefined) {
    conditions.push(eq(websiteContactSubmissions.processed, input.processed));
  }

  if (input.cursor) {
    const [cursorDate, cursorId] = input.cursor.split("_");
    if (cursorDate && cursorId) {
      conditions.push(
        sql`(${websiteContactSubmissions.submittedAt}, ${websiteContactSubmissions.id}) < (${new Date(cursorDate)}, ${cursorId}::uuid)`
      );
    }
  }

  const rows = await ctx.db
    .select()
    .from(websiteContactSubmissions)
    .where(and(...conditions))
    .orderBy(
      desc(websiteContactSubmissions.submittedAt),
      desc(websiteContactSubmissions.id)
    )
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Resolve vehicle references
  const vehicleIds = [...new Set(items.filter((r) => r.vehicleId).map((r) => r.vehicleId!))];
  const vehicleMap = new Map<string, { id: string; make: string; model: string }>();
  if (vehicleIds.length > 0) {
    const vehicleRows = await ctx.db
      .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(and(eq(vehicles.tenantId, ctx.tenantId), sql`${vehicles.id} = ANY(${vehicleIds})`));
    vehicleRows.forEach((v) => vehicleMap.set(v.id, v));
  }

  const views: SubmissionView[] = items.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? null,
    message: r.message,
    vehicle: r.vehicleId ? (vehicleMap.get(r.vehicleId) ?? null) : null,
    processed: r.processed,
    contactId: r.contactId ?? null,
    submittedAt: r.submittedAt.toISOString(),
  }));

  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? `${lastItem.submittedAt.toISOString()}_${lastItem.id}`
      : null;

  return { items: views, nextCursor };
}

// ---------------------------------------------------------------------------
// processSubmission
// ---------------------------------------------------------------------------

export async function processSubmission(
  input: ProcessSubmissionInput,
  ctx: TrpcContext
): Promise<{ contactId: string }> {
  const [submission] = await ctx.db
    .select()
    .from(websiteContactSubmissions)
    .where(
      and(
        eq(websiteContactSubmissions.id, input.submissionId),
        eq(websiteContactSubmissions.tenantId, ctx.tenantId)
      )
    )
    .limit(1);

  if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
  if (submission.processed) throw new TRPCError({ code: "CONFLICT", message: "Anfrage bereits bearbeitet." });

  // CRM: create or find contact
  const { contact } = await createContactFromExternal(
    {
      firstName: submission.name.split(" ")[0] ?? submission.name,
      lastName: submission.name.split(" ").slice(1).join(" ") || undefined,
      email: submission.email,
      phone: submission.phone ?? undefined,
      source: "website",
      initialActivity: {
        activityType: submission.vehicleId ? "vehicle_interest" : "note",
        title: submission.vehicleId
          ? "Website-Anfrage zu Fahrzeug"
          : "Website-Kontaktanfrage",
        description: submission.message,
        vehicleId: submission.vehicleId ?? undefined,
      },
    },
    ctx.tenantId,
    ctx.db
  );

  // Mark submission as processed
  await ctx.db
    .update(websiteContactSubmissions)
    .set({ processed: true, contactId: contact.id })
    .where(eq(websiteContactSubmissions.id, input.submissionId));

  await ctx.db.insert(auditLog).values({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "website.processSubmission",
    resourceType: "website_contact_submission",
    resourceId: input.submissionId,
  });

  return { contactId: contact.id };
}

// ---------------------------------------------------------------------------
// getPreviewUrl
// ---------------------------------------------------------------------------

export async function getPreviewUrl(ctx: TrpcContext): Promise<{ url: string }> {
  const slug = await getTenantSlug(ctx.tenantId, ctx.db);
  if (!slug) throw new TRPCError({ code: "NOT_FOUND" });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { url: `${baseUrl}/${slug}` };
}

// ---------------------------------------------------------------------------
// Public: getPublicSettings (for API route, no auth)
// ---------------------------------------------------------------------------

export async function getPublicSettings(
  tenantSlug: string,
  serviceDb: TrpcContext["db"]
): Promise<PublicWebsiteSettings | null> {
  const [tenant] = await serviceDb
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        eq(tenants.slug, tenantSlug),
        sql`${tenants.status} IN ('active', 'trial')`
      )
    )
    .limit(1);

  if (!tenant) return null;

  const [settings] = await serviceDb
    .select()
    .from(websiteSettings)
    .where(eq(websiteSettings.tenantId, tenant.id))
    .limit(1);

  if (!settings?.isPublished) return null;

  return {
    isPublished: true,
    heroHeadline: settings.heroHeadline,
    heroSubheadline: settings.heroSubheadline,
    heroCtatext: settings.heroCtatext,
    aboutText: settings.aboutText,
    contactFormEnabled: settings.contactFormEnabled,
    metaTitle: settings.metaTitle,
    metaDescription: settings.metaDescription,
    googleAnalyticsId: settings.googleAnalyticsId,
  };
}

// ---------------------------------------------------------------------------
// Public: saveContactSubmission (for forms API route, no auth)
// ---------------------------------------------------------------------------

export async function saveContactSubmission(
  tenantSlug: string,
  data: {
    name: string;
    email: string;
    phone?: string;
    message: string;
    vehicleId?: string;
    ipAddress?: string;
    honeypot?: string;
  },
  serviceDb: TrpcContext["db"]
): Promise<{ ok: boolean }> {
  // Honeypot check — bots fill hidden fields
  if (data.honeypot) return { ok: true }; // Silently discard

  const [tenant] = await serviceDb
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        eq(tenants.slug, tenantSlug),
        sql`${tenants.status} IN ('active', 'trial')`
      )
    )
    .limit(1);

  if (!tenant) return { ok: false };

  // Check website is published and contact form is enabled
  const [settings] = await serviceDb
    .select({ isPublished: websiteSettings.isPublished, contactFormEnabled: websiteSettings.contactFormEnabled, contactFormRecipients: websiteSettings.contactFormRecipients })
    .from(websiteSettings)
    .where(eq(websiteSettings.tenantId, tenant.id))
    .limit(1);

  if (!settings?.isPublished || !settings.contactFormEnabled) return { ok: false };

  // Rate limiting: count submissions from this IP in last hour
  if (data.ipAddress) {
    const countResult = await serviceDb
      .select({ submissionCount: sql<number>`count(*)::int` })
      .from(websiteContactSubmissions)
      .where(
        and(
          eq(websiteContactSubmissions.tenantId, tenant.id),
          eq(websiteContactSubmissions.ipAddress, data.ipAddress),
          gt(websiteContactSubmissions.submittedAt, new Date(Date.now() - 60 * 60 * 1000))
        )
      );

    const submissionCount = countResult[0]?.submissionCount ?? 0;
    if (submissionCount >= 5) return { ok: false }; // Rate limited
  }

  await serviceDb.insert(websiteContactSubmissions).values({
    tenantId: tenant.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    message: data.message,
    vehicleId: data.vehicleId ?? null,
    ipAddress: data.ipAddress,
    honeypot: data.honeypot,
  });

  // Queue email notification via outbox (non-blocking)
  if (settings.contactFormRecipients && settings.contactFormRecipients.length > 0) {
    // Outbox entry for email — handled by process-outbox cron
    // (email module will be wired when Resend integration is built)
  }

  return { ok: true };
}
