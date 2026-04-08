/**
 * DNA-Engine Service — all business logic for branding.
 *
 * tRPC router is a thin orchestration layer. All real work happens here.
 * Spec: MOD_34 Sections 5, 6, 7, 11, 12
 */

import { eq, inArray } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { TRPCError } from "@trpc/server";

import { tenantBranding, dnaCrawlResults } from "../db/schema";
import { tenants } from "@/server/db/schema/tenants";
import { files } from "@/server/db/schema/files";
import { generateColorPalette } from "../domain/color-palette";
import { COMPLETENESS_FIELDS } from "../domain/constants";
import { callClaude, parseClaudeJson } from "@/shared/lib/ai";
import { createSupabaseServiceClient } from "@/shared/lib/supabase/server";
import {
  normalizeUrl,
  checkRobotsTxt,
  fetchWebsiteHtml,
  extractDataFromHtml,
  downloadLogoCandidate,
} from "@/server/services/website-crawler";
import sharp from "sharp";
import type { TrpcContext } from "@/server/trpc/context";
import * as schema from "@/server/db/schema";

// DbLike covers both the full Drizzle DB client and transaction objects.
// PgTransaction implements the same query API as PostgresJsDatabase (select/update/insert).
type DbLike =
  | TrpcContext["db"]
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;
import type {
  TenantBrandingRecord,
  TenantBrandingView,
  PublicBranding,
  DnaCrawlResult,
  ColorPalette,
  Address,
  OpeningHours,
  ImprintData,
  AiAnalysisResult,
  RegeneratableTextField,
  CompletenessEnum,
} from "../domain/types";
import type {
  UpdateVisualIdentityInput,
  UpdateCommunicationInput,
  UpdateBusinessDataInput,
  ApplyCrawlResultInput,
} from "../domain/validators";

// ---------------------------------------------------------------------------
// File URL resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a Supabase Storage public URL from a file record's storagePath.
 * Returns null if fileId is null or file not found.
 */
async function resolveFileUrl(
  fileId: string | null,
  db: DbLike
): Promise<string | null> {
  if (!fileId) return null;

  const [file] = await db
    .select({ storagePath: files.storagePath })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  return `${supabaseUrl}/storage/v1/object/public/${file.storagePath}`;
}

// ---------------------------------------------------------------------------
// Record → View transformation
// ---------------------------------------------------------------------------

function recordToView(
  record: TenantBrandingRecord,
  tenantName: string,
  logoUrl: string | null,
  faviconUrl: string | null
): TenantBrandingView {
  return {
    id: record.id,
    tenantId: record.tenantId,
    tenantName,
    logoUrl,
    faviconUrl,
    primaryColor: record.primaryColor,
    secondaryColor: record.secondaryColor,
    accentColor: record.accentColor ?? null,
    backgroundColor: record.backgroundColor,
    textColor: record.textColor,
    colorPalette: (record.colorPalette as ColorPalette) ?? {},
    fontHeading: record.fontHeading,
    fontBody: record.fontBody,
    borderRadius: record.borderRadius,
    buttonStyle: record.buttonStyle,
    tone: record.tone,
    formality: record.formality,
    dealershipType: record.dealershipType,
    tagline: record.tagline ?? null,
    welcomeMessage: record.welcomeMessage ?? null,
    emailSignature: record.emailSignature ?? null,
    descriptionStyle: record.descriptionStyle,
    address: (record.address as Address) ?? null,
    phone: record.phone ?? null,
    email: record.email ?? null,
    openingHours: (record.openingHours as OpeningHours) ?? null,
    websiteUrl: record.websiteUrl ?? null,
    googleMapsUrl: record.googleMapsUrl ?? null,
    imprintData: (record.imprintData as ImprintData) ?? null,
    completeness: record.completeness,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Completeness calculation
// ---------------------------------------------------------------------------

export function calculateCompleteness(
  record: Partial<TenantBrandingRecord>
): CompletenessEnum {
  const hasPublishReady = COMPLETENESS_FIELDS.publish_ready.every((field) => {
    const value = record[field as keyof TenantBrandingRecord];
    return value !== null && value !== undefined;
  });

  if (hasPublishReady) return "publish_ready";

  const hasBrandingComplete = COMPLETENESS_FIELDS.branding_complete.every(
    (field) => {
      const value = record[field as keyof TenantBrandingRecord];
      return value !== null && value !== undefined;
    }
  );

  if (hasBrandingComplete) return "branding_complete";

  return "draft";
}

// ---------------------------------------------------------------------------
// Compact copy sync — MUST run in same transaction as branding update
// ---------------------------------------------------------------------------

async function syncBrandingCompactCopy(
  record: TenantBrandingRecord,
  logoUrl: string | null,
  db: DbLike
): Promise<void> {
  await db
    .update(tenants)
    .set({
      branding: {
        primaryColor: record.primaryColor,
        tone: record.tone,
        formality: record.formality,
        descriptionStyle: record.descriptionStyle,
        logoPublicUrl: logoUrl,
      },
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, record.tenantId));
}

// ---------------------------------------------------------------------------
// Core read operations
// ---------------------------------------------------------------------------

/**
 * Fetches the branding view for the current tenant (uses RLS via ctx.db).
 */
export async function getBranding(ctx: TrpcContext): Promise<TenantBrandingView> {
  const [record] = await ctx.db
    .select()
    .from(tenantBranding)
    .where(eq(tenantBranding.tenantId, ctx.tenantId))
    .limit(1);

  if (!record) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Branding-Profil nicht gefunden. Bitte Registrierung prüfen.",
    });
  }

  const [tenant] = await ctx.db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId))
    .limit(1);

  const tenantName = tenant?.name ?? "";
  const [logoUrl, faviconUrl] = await Promise.all([
    resolveFileUrl(record.logoFileId, ctx.db),
    resolveFileUrl(record.faviconFileId, ctx.db),
  ]);

  return recordToView(record, tenantName, logoUrl, faviconUrl);
}

/**
 * Fetches the branding view by tenant ID — for consumption by other modules.
 * Accepts db directly (not full ctx) so modules can pass their own db instance.
 */
export async function getBrandingForTenant(
  tenantId: string,
  db: TrpcContext["db"]
): Promise<TenantBrandingView> {
  const [[record], [tenant]] = await Promise.all([
    db
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenantId))
      .limit(1),
    db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1),
  ]);

  if (!record) {
    throw new Error(`Branding not found for tenant ${tenantId}`);
  }

  const [logoUrl, faviconUrl] = await Promise.all([
    resolveFileUrl(record.logoFileId, db),
    resolveFileUrl(record.faviconFileId, db),
  ]);

  return recordToView(record, tenant?.name ?? "", logoUrl, faviconUrl);
}

/**
 * Public branding for a tenant slug — uses service role (no RLS).
 * Returns null if tenant not found or not publish_ready.
 * Called by the public API route handler.
 */
export async function getPublicBrandingForSlug(
  slug: string
): Promise<PublicBranding | null> {
  const supabase = createSupabaseServiceClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, name, slug, status")
    .eq("slug", slug)
    .single();

  if (!tenantRow) return null;
  if (!["active", "trial"].includes(tenantRow.status)) return null;

  const { data: brandingRow } = await supabase
    .from("tenant_branding")
    .select("*")
    .eq("tenant_id", tenantRow.id)
    .single();

  if (!brandingRow || brandingRow.completeness !== "publish_ready") return null;

  // Resolve file URLs
  const resolveStorageUrl = async (fileId: string | null): Promise<string | null> => {
    if (!fileId) return null;
    const { data: fileRow } = await supabase
      .from("files")
      .select("storage_path")
      .eq("id", fileId)
      .single();
    if (!fileRow) return null;
    return `${supabaseUrl}/storage/v1/object/public/${fileRow.storage_path}`;
  };

  const [logoUrl, faviconUrl] = await Promise.all([
    resolveStorageUrl(brandingRow.logo_file_id),
    resolveStorageUrl(brandingRow.favicon_file_id),
  ]);

  return {
    name: tenantRow.name,
    slug: tenantRow.slug,
    primaryColor: brandingRow.primary_color,
    secondaryColor: brandingRow.secondary_color,
    accentColor: brandingRow.accent_color ?? null,
    backgroundColor: brandingRow.background_color,
    textColor: brandingRow.text_color,
    colorPalette: (brandingRow.color_palette as ColorPalette) ?? {},
    fontHeading: brandingRow.font_heading,
    fontBody: brandingRow.font_body,
    borderRadius: brandingRow.border_radius,
    buttonStyle: brandingRow.button_style,
    tone: brandingRow.tone,
    formality: brandingRow.formality,
    tagline: brandingRow.tagline ?? null,
    logoUrl,
    faviconUrl,
    address: (brandingRow.address as Address) ?? null,
    phone: brandingRow.phone ?? null,
    email: brandingRow.email ?? null,
    openingHours: (brandingRow.opening_hours as OpeningHours) ?? null,
    googleMapsUrl: brandingRow.google_maps_url ?? null,
  };
}

// ---------------------------------------------------------------------------
// getPublicImprintForSlug — no auth, service role, for Impressum page
// ---------------------------------------------------------------------------

export async function getPublicImprintForSlug(slug: string): Promise<{
  name: string;
  address: Address | null;
  phone: string | null;
  email: string | null;
  imprintData: ImprintData | null;
} | null> {
  const supabase = createSupabaseServiceClient();

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, name, status")
    .eq("slug", slug)
    .single();

  if (!tenantRow) return null;
  if (!["active", "trial"].includes(tenantRow.status)) return null;

  const { data: brandingRow } = await supabase
    .from("tenant_branding")
    .select("address, phone, email, imprint_data")
    .eq("tenant_id", tenantRow.id)
    .single();

  return {
    name: tenantRow.name,
    address: (brandingRow?.address as Address) ?? null,
    phone: brandingRow?.phone ?? null,
    email: brandingRow?.email ?? null,
    imprintData: (brandingRow?.imprint_data as ImprintData) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Update operations (each runs in a transaction + syncs compact copy)
// ---------------------------------------------------------------------------

export async function updateVisualIdentity(
  input: UpdateVisualIdentityInput,
  ctx: TrpcContext
): Promise<TenantBrandingView> {
  return ctx.db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .limit(1);

    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Branding nicht gefunden" });
    }

    const newPrimary = input.primaryColor ?? current.primaryColor;
    const newSecondary = input.secondaryColor ?? current.secondaryColor;

    // Regenerate palette if colors changed
    const colorPalette =
      input.primaryColor || input.secondaryColor
        ? generateColorPalette(newPrimary, newSecondary)
        : (current.colorPalette as ColorPalette);

    const updates = {
      ...input,
      colorPalette,
      updatedAt: new Date(),
    };

    const completeness = calculateCompleteness({ ...current, ...updates });

    const [updated] = await tx
      .update(tenantBranding)
      .set({ ...updates, completeness })
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .returning();

    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const logoUrl = await resolveFileUrl(updated.logoFileId, tx);
    await syncBrandingCompactCopy(updated, logoUrl, tx);

    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const faviconUrl = await resolveFileUrl(updated.faviconFileId, tx);
    return recordToView(updated, tenant?.name ?? "", logoUrl, faviconUrl);
  });
}

export async function updateCommunicationIdentity(
  input: UpdateCommunicationInput,
  ctx: TrpcContext
): Promise<TenantBrandingView> {
  return ctx.db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .limit(1);

    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Branding nicht gefunden" });
    }

    const updates = { ...input, updatedAt: new Date() };
    const completeness = calculateCompleteness({ ...current, ...updates });

    const [updated] = await tx
      .update(tenantBranding)
      .set({ ...updates, completeness })
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .returning();

    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const logoUrl = await resolveFileUrl(updated.logoFileId, tx);
    await syncBrandingCompactCopy(updated, logoUrl, tx);

    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const faviconUrl = await resolveFileUrl(updated.faviconFileId, tx);
    return recordToView(updated, tenant?.name ?? "", logoUrl, faviconUrl);
  });
}

export async function updateBusinessData(
  input: UpdateBusinessDataInput,
  ctx: TrpcContext
): Promise<TenantBrandingView> {
  return ctx.db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .limit(1);

    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Branding nicht gefunden" });
    }

    const updates = { ...input, updatedAt: new Date() };
    const completeness = calculateCompleteness({ ...current, ...updates });

    const [updated] = await tx
      .update(tenantBranding)
      .set({ ...updates, completeness })
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .returning();

    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const logoUrl = await resolveFileUrl(updated.logoFileId, tx);
    await syncBrandingCompactCopy(updated, logoUrl, tx);

    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const faviconUrl = await resolveFileUrl(updated.faviconFileId, tx);
    return recordToView(updated, tenant?.name ?? "", logoUrl, faviconUrl);
  });
}

// ---------------------------------------------------------------------------
// Website Crawl (synchronous, spec Section 5.1)
// ---------------------------------------------------------------------------

/** AI analysis prompt — spec Section 6 */
function buildAnalysisPrompt(
  extractedData: ReturnType<typeof extractDataFromHtml>,
  primaryColor: string
): string {
  return `Analysiere die folgenden extrahierten Website-Daten und erstelle ein Branding-Profil.

Extrahierte Daten:
${JSON.stringify(extractedData, null, 2)}

Primärfarbe (bereits ermittelt): ${primaryColor}

Aufgabe:
1. Bestimme die Tonalität: professional, friendly, premium, casual.
2. Bestimme die Anredeform: "du" oder "sie".
3. Klassifiziere den Händlertyp: einzelhaendler, autohaus, mehrmarkenhaendler, premiumhaendler.
4. Schlage secondary_color und accent_color passend zur Primärfarbe vor.
5. Wähle ein Font-Pairing passend zur Tonalität.
   Erlaubte heading fonts: Inter, Nunito, Playfair Display, Poppins.
   Erlaubte body fonts: Inter, Open Sans, Lato, Nunito Sans.
6. Extrahiere oder generiere eine Tagline (max. 8 Worte).
7. Generiere eine kurze Willkommensnachricht (2-3 Sätze) im Ton des Händlers.

Antworte NUR mit validem JSON ohne Markdown:
{
  "tone": "professional|friendly|premium|casual",
  "tone_reasoning": "...",
  "formality": "du|sie",
  "formality_reasoning": "...",
  "dealership_type": "einzelhaendler|autohaus|mehrmarkenhaendler|premiumhaendler",
  "secondary_color": "#XXXXXX",
  "accent_color": "#XXXXXX",
  "font_heading": "Inter|Nunito|Playfair Display|Poppins",
  "font_body": "Inter|Open Sans|Lato|Nunito Sans",
  "tagline": "...",
  "welcome_message": "...",
  "confidence": { "tone": 0.0, "formality": 0.0, "type": 0.0 }
}`;
}

/**
 * Validates and maps the raw AI JSON to typed AiAnalysisResult.
 * Returns null if the response is unparseable or missing required fields.
 */
function parseAiAnalysis(raw: string): AiAnalysisResult | null {
  try {
    const data = parseClaudeJson<Record<string, unknown>>(raw);
    return {
      tone: (data.tone as AiAnalysisResult["tone"]) ?? "professional",
      toneReasoning: String(data.tone_reasoning ?? ""),
      formality: (data.formality as AiAnalysisResult["formality"]) ?? "sie",
      formalityReasoning: String(data.formality_reasoning ?? ""),
      dealershipType:
        (data.dealership_type as AiAnalysisResult["dealershipType"]) ??
        "einzelhaendler",
      secondaryColor: String(data.secondary_color ?? "#1E40AF"),
      accentColor: data.accent_color ? String(data.accent_color) : undefined,
      fontHeading:
        (data.font_heading as AiAnalysisResult["fontHeading"]) ?? "Inter",
      fontBody: (data.font_body as AiAnalysisResult["fontBody"]) ?? "Inter",
      tagline: data.tagline ? String(data.tagline) : undefined,
      welcomeMessage: data.welcome_message
        ? String(data.welcome_message)
        : undefined,
      confidence: {
        tone: Number((data.confidence as Record<string, unknown>)?.tone ?? 0.5),
        formality: Number(
          (data.confidence as Record<string, unknown>)?.formality ?? 0.5
        ),
        type: Number(
          (data.confidence as Record<string, unknown>)?.type ?? 0.5
        ),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Processes a logo buffer through the asset pipeline:
 * validates, processes with sharp, uploads to Supabase Storage, creates files record.
 * Returns { logoFileId, faviconFileId, logoUrl, faviconUrl } or null on failure.
 */
async function ingestLogoBuffer(
  buffer: Buffer,
  tenantId: string,
  brandingId: string,
  db: DbLike
): Promise<{
  logoFileId: string;
  faviconFileId: string;
  logoUrl: string;
  faviconUrl: string;
} | null> {
  try {
    const supabase = createSupabaseServiceClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

    // Validate image
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) return null;
    if (meta.width < 100 || meta.height < 100) return null;
    if (!["png", "jpeg", "webp"].includes(meta.format ?? "")) return null;

    // Process: WebP logo + thumbnail
    const [logoWebp, thumbWebp, favicon32, favicon192] = await Promise.all([
      sharp(buffer).webp().toBuffer(),
      sharp(buffer).resize(200, 200, { fit: "inside", withoutEnlargement: true }).webp().toBuffer(),
      sharp(buffer).resize(32, 32).png().toBuffer(),
      sharp(buffer).resize(192, 192).png().toBuffer(),
    ]);

    const logoPath = `branding/${tenantId}/logo.webp`;
    const thumbPath = `branding/${tenantId}/logo-thumb.webp`;
    const favicon32Path = `branding/${tenantId}/favicon-32.png`;
    const favicon192Path = `branding/${tenantId}/favicon-192.png`;

    // Upload to Supabase Storage
    await Promise.all([
      supabase.storage.from("branding").upload(logoPath, logoWebp, {
        contentType: "image/webp",
        upsert: true,
      }),
      supabase.storage.from("branding").upload(thumbPath, thumbWebp, {
        contentType: "image/webp",
        upsert: true,
      }),
      supabase.storage.from("branding").upload(favicon32Path, favicon32, {
        contentType: "image/png",
        upsert: true,
      }),
      supabase.storage.from("branding").upload(favicon192Path, favicon192, {
        contentType: "image/png",
        upsert: true,
      }),
    ]);

    // Insert files records
    const [logoFile] = await db
      .insert(files)
      .values({
        tenantId,
        entityType: "branding",
        entityId: brandingId,
        storagePath: logoPath,
        originalName: "logo.webp",
        mimeType: "image/webp",
        sizeBytes: logoWebp.byteLength,
        width: meta.width,
        height: meta.height,
        kind: "logo",
        isPublic: true,
        processingStatus: "processed",
      })
      .returning({ id: files.id });

    const [faviconFile] = await db
      .insert(files)
      .values({
        tenantId,
        entityType: "branding",
        entityId: brandingId,
        storagePath: favicon32Path,
        originalName: "favicon-32.png",
        mimeType: "image/png",
        sizeBytes: favicon32.byteLength,
        width: 32,
        height: 32,
        kind: "favicon",
        isPublic: true,
        processingStatus: "processed",
      })
      .returning({ id: files.id });

    if (!logoFile || !faviconFile) return null;

    return {
      logoFileId: logoFile.id,
      faviconFileId: faviconFile.id,
      logoUrl: `${supabaseUrl}/storage/v1/object/public/${logoPath}`,
      faviconUrl: `${supabaseUrl}/storage/v1/object/public/${favicon32Path}`,
    };
  } catch {
    return null;
  }
}

/**
 * Starts a website crawl synchronously.
 * Returns the full DnaCrawlResult — no polling needed.
 * Spec: MOD_34 Section 5.1
 */
export async function startCrawl(
  url: string,
  ctx: TrpcContext
): Promise<DnaCrawlResult> {
  const startTime = Date.now();

  // Normalize URL
  const normalizedUrl = normalizeUrl(url);

  // Check for existing active crawl (partial unique index also enforces this at DB level)
  const [activeCrawl] = await ctx.db
    .select({ id: dnaCrawlResults.id })
    .from(dnaCrawlResults)
    .where(
      inArray(dnaCrawlResults.status, ["pending", "crawling", "analyzing"])
    )
    .limit(1);

  if (activeCrawl) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Es läuft bereits ein Crawl. Bitte warten.",
    });
  }

  // Create crawl record
  const [crawlRecord] = await ctx.db
    .insert(dnaCrawlResults)
    .values({
      tenantId: ctx.tenantId,
      sourceUrl: normalizedUrl,
      status: "crawling",
      startedAt: new Date(),
    })
    .returning();

  if (!crawlRecord) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  const crawlId = crawlRecord.id;
  type LogoIngestionResult = {
    logoFileId: string;
    faviconFileId: string;
    logoUrl: string;
    faviconUrl: string;
  } | null;

  let errorMessage: string | undefined;
  let extractedData: ReturnType<typeof extractDataFromHtml> | undefined;
  let aiAnalysis: AiAnalysisResult | null = null;
  let logoIngestion: LogoIngestionResult = null;

  // Total timeout: 25 seconds
  const overallTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Overall crawl timeout (25s)")), 25000)
  );

  try {
    await Promise.race([
      (async () => {
        // Step 1: robots.txt check
        const allowed = await checkRobotsTxt(normalizedUrl);
        if (!allowed) {
          throw new Error("robots.txt verbietet den Crawl dieser URL");
        }

        // Step 2: Fetch HTML
        const { html } = await fetchWebsiteHtml(normalizedUrl);

        // Step 3: Extract data
        await ctx.db
          .update(dnaCrawlResults)
          .set({ status: "analyzing", rawHtml: html, updatedAt: new Date() })
          .where(eq(dnaCrawlResults.id, crawlId));

        extractedData = extractDataFromHtml(html, normalizedUrl);

        // Determine primary color from extracted colors
        const primaryColor =
          extractedData.colorsFound[0]?.hex ?? "#2563EB";

        // Step 4: Ingest logo (if found) — skip SVG, sharp only handles raster formats
        const rasterCandidates = extractedData.logoCandidates.filter(
          (c) => !c.url.toLowerCase().endsWith(".svg")
        );
        const [firstLogoCandidate] = rasterCandidates;
        if (firstLogoCandidate) {
          const logoBuffer = await downloadLogoCandidate(firstLogoCandidate.url);
          if (logoBuffer) {
            const [brandingRecord] = await ctx.db
              .select({ id: tenantBranding.id })
              .from(tenantBranding)
              .where(eq(tenantBranding.tenantId, ctx.tenantId))
              .limit(1);

            if (brandingRecord) {
              logoIngestion = await ingestLogoBuffer(
                logoBuffer,
                ctx.tenantId,
                brandingRecord.id,
                ctx.db
              );
            }
          }
        }

        // Step 5: AI analysis
        const analysisPrompt = buildAnalysisPrompt(extractedData, primaryColor);
        const aiRaw = await callClaude({
          systemPrompt:
            "Du bist ein Branding-Analyst für Autohäuser. Antworte immer auf Deutsch. Analysiere die Daten und erstelle ein Branding-Profil als JSON.",
          userPrompt: analysisPrompt,
          maxTokens: 1000,
        });

        aiAnalysis = parseAiAnalysis(aiRaw);
      })(),
      overallTimeout,
    ]);
  } catch (err) {
    errorMessage = (err as Error).message;
  }

  // Build final update
  const [finalRecord] = await ctx.db
    .update(dnaCrawlResults)
    .set({
      status: errorMessage && !extractedData ? "failed" : "completed",
      extractedData: extractedData ?? null,
      aiAnalysis: aiAnalysis ?? null,
      errorMessage: errorMessage ?? null,
      durationMs: Date.now() - startTime,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dnaCrawlResults.id, crawlId))
    .returning();

  // If we ingested a logo, update branding record immediately
  // Use destructuring to help TypeScript narrow past the post-try/catch scope
  const ingestedLogo: LogoIngestionResult = logoIngestion;
  if (ingestedLogo != null) {
    const { logoFileId, faviconFileId, logoUrl: ingestedLogoUrl } = ingestedLogo;

    const completenessUpdate = await ctx.db
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .limit(1);

    const current = completenessUpdate[0];
    if (current) {
      const updated = { ...current, logoFileId, faviconFileId };
      const completeness = calculateCompleteness(updated);
      await ctx.db
        .update(tenantBranding)
        .set({ logoFileId, faviconFileId, completeness, updatedAt: new Date() })
        .where(eq(tenantBranding.tenantId, ctx.tenantId));

      // Sync compact copy
      await ctx.db
        .update(tenants)
        .set({
          branding: {
            primaryColor: current.primaryColor,
            tone: current.tone,
            formality: current.formality,
            descriptionStyle: current.descriptionStyle,
            logoPublicUrl: ingestedLogoUrl,
          },
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, ctx.tenantId));
    }
  }

  return finalRecord ?? crawlRecord;
}

// ---------------------------------------------------------------------------
// Apply crawl result
// ---------------------------------------------------------------------------

export async function applyCrawlResult(
  input: ApplyCrawlResultInput,
  ctx: TrpcContext
): Promise<TenantBrandingView> {
  const [crawl] = await ctx.db
    .select()
    .from(dnaCrawlResults)
    .where(eq(dnaCrawlResults.id, input.crawlId))
    .limit(1);

  if (!crawl) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Crawl nicht gefunden" });
  }
  if (crawl.status !== "completed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Crawl ist nicht abgeschlossen",
    });
  }
  if (crawl.appliedAt) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Crawl wurde bereits angewendet",
    });
  }

  const ai = (crawl.aiAnalysis ?? {}) as Partial<AiAnalysisResult>;
  const extracted = (crawl.extractedData ?? {}) as Partial<
    ReturnType<typeof extractDataFromHtml>
  >;

  // Merge: AI-analyzed values → extracted values → overrides → defaults
  const primaryColor =
    input.visualOverrides?.primaryColor ??
    extracted.colorsFound?.[0]?.hex ??
    "#2563EB";
  const secondaryColor =
    input.visualOverrides?.secondaryColor ?? ai.secondaryColor ?? "#1E40AF";
  const colorPalette = generateColorPalette(primaryColor, secondaryColor);

  const generationLog: Record<string, string> = {};

  return ctx.db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .limit(1);

    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const updates: Partial<TenantBrandingRecord> & { updatedAt: Date } = {
      primaryColor,
      secondaryColor,
      accentColor: input.visualOverrides?.accentColor ?? ai.accentColor ?? null,
      colorPalette,
      fontHeading:
        input.visualOverrides?.fontHeading ?? ai.fontHeading ?? "Inter",
      fontBody: input.visualOverrides?.fontBody ?? ai.fontBody ?? "Inter",
      borderRadius: input.visualOverrides?.borderRadius ?? current.borderRadius,
      buttonStyle: input.visualOverrides?.buttonStyle ?? current.buttonStyle,
      tone: input.communicationOverrides?.tone ?? ai.tone ?? current.tone,
      formality:
        input.communicationOverrides?.formality ??
        ai.formality ??
        current.formality,
      dealershipType:
        input.communicationOverrides?.dealershipType ??
        ai.dealershipType ??
        current.dealershipType,
      tagline:
        input.communicationOverrides?.tagline !== undefined
          ? input.communicationOverrides.tagline
          : (ai.tagline ?? current.tagline),
      welcomeMessage:
        input.communicationOverrides?.welcomeMessage !== undefined
          ? input.communicationOverrides.welcomeMessage
          : (ai.welcomeMessage ?? current.welcomeMessage),
      descriptionStyle:
        input.communicationOverrides?.descriptionStyle ??
        current.descriptionStyle,
      address:
        input.businessOverrides?.address !== undefined
          ? input.businessOverrides.address
          : ((extracted.contact?.address as Address | undefined) ??
              (current.address as Address | null)),
      phone:
        input.businessOverrides?.phone !== undefined
          ? input.businessOverrides.phone
          : (extracted.contact?.phone ?? current.phone),
      email:
        input.businessOverrides?.email !== undefined
          ? input.businessOverrides.email
          : (extracted.contact?.email ?? current.email),
      websiteUrl: crawl.sourceUrl,
      onboardingSource: crawl.sourceUrl,
      generationLog,
      updatedAt: new Date(),
    };

    const completeness = calculateCompleteness({ ...current, ...updates });

    const [updated] = await tx
      .update(tenantBranding)
      .set({ ...updates, completeness })
      .where(eq(tenantBranding.tenantId, ctx.tenantId))
      .returning();

    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Mark crawl as applied
    await tx
      .update(dnaCrawlResults)
      .set({ appliedAt: new Date(), updatedAt: new Date() })
      .where(eq(dnaCrawlResults.id, input.crawlId));

    const logoUrl = await resolveFileUrl(updated.logoFileId, tx);
    await syncBrandingCompactCopy(updated, logoUrl, tx);

    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const faviconUrl = await resolveFileUrl(updated.faviconFileId, tx);
    return recordToView(updated, tenant?.name ?? "", logoUrl, faviconUrl);
  });
}

// ---------------------------------------------------------------------------
// Text regeneration (read-only — result is NOT saved)
// ---------------------------------------------------------------------------

export async function regenerateText(
  field: RegeneratableTextField,
  ctx: TrpcContext
): Promise<string> {
  const [branding] = await ctx.db
    .select()
    .from(tenantBranding)
    .where(eq(tenantBranding.tenantId, ctx.tenantId))
    .limit(1);

  const [tenant] = await ctx.db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId))
    .limit(1);

  const dealerName = tenant?.name ?? "Autohaus";
  const tone = branding?.tone ?? "professional";
  const formality = branding?.formality ?? "sie";
  const dealershipType = branding?.dealershipType ?? "autohaus";

  const fieldDescriptions: Record<RegeneratableTextField, string> = {
    welcome_message:
      "eine kurze Willkommensnachricht für die Website (2-3 Sätze)",
    email_signature:
      "eine E-Mail-Signatur mit Kontaktdaten (3-4 Zeilen, ohne konkrete Daten die du nicht kennst)",
    tagline: "einen prägnanten Slogan (max. 8 Worte)",
  };

  const text = await callClaude({
    systemPrompt: `Du bist ein Textverfasser für ${dealerName}, ein ${dealershipType}.
Tonalität: ${tone}. Anrede: ${formality === "du" ? "Du-Form" : "Sie-Form"}.
Schreibe immer auf Deutsch. Gib nur den gewünschten Text zurück, keine Erklärungen.`,
    userPrompt: `Schreibe ${fieldDescriptions[field]} für ${dealerName}.`,
    maxTokens: 300,
  });

  return text.trim();
}
