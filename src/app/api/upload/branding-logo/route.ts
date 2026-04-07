/**
 * Logo Upload Route Handler
 *
 * tRPC cannot handle multipart/form-data — dedicated Route Handler required.
 * Spec: MOD_34 Section 5.5 + Section 7 (dna.uploadLogo)
 *
 * POST /api/upload/branding-logo
 * Auth: owner | admin only
 * Input: multipart/form-data with field "logo" (File)
 * Output: { logoFileId, faviconFileId, logoUrl, faviconUrl }
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/shared/lib/supabase/server";
import { createTenantDb } from "@/server/db/create-tenant-db";
import { tenantBranding } from "@/modules/dna-engine/db/schema";
import { tenants } from "@/server/db/schema/tenants";
import { files } from "@/server/db/schema/files";
import { calculateCompleteness } from "@/modules/dna-engine/services/dna-service";

// Allowed MIME types + their magic bytes
const ALLOWED_SIGNATURES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF" — further validated below
};

function detectMimeType(buffer: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(ALLOWED_SIGNATURES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buffer[i] === byte)) {
        // Extra check for WebP: bytes 8-11 must be "WEBP"
        if (mime === "image/webp") {
          const webpMarker = buffer.slice(8, 12).toString("ascii");
          if (webpMarker !== "WEBP") continue;
        }
        return mime;
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Auth ---
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Decode JWT claims
  const jwt = session.access_token;
  let claims: { sub: string; tenant_id: string; role: string } | null = null;
  try {
    const parts = jwt.split(".");
    if (parts[1]) {
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    }
  } catch {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 401 });
  }

  if (!claims?.tenant_id || !claims?.sub) {
    return NextResponse.json({ error: "Unvollständige JWT-Claims" }, { status: 401 });
  }

  if (!["owner", "admin"].includes(claims.role ?? "")) {
    return NextResponse.json(
      { error: "Keine Berechtigung. Nur Owner und Admin dürfen das Logo ändern." },
      { status: 403 }
    );
  }

  // --- Parse multipart ---
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Formulardaten" }, { status: 400 });
  }

  const logoFile = formData.get("logo");
  if (!logoFile || !(logoFile instanceof File)) {
    return NextResponse.json({ error: "Kein Logo hochgeladen (Feld: logo)" }, { status: 400 });
  }

  // --- Size check ---
  if (logoFile.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Logo ist zu groß. Maximal 5 MB erlaubt." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await logoFile.arrayBuffer());

  // --- Magic bytes MIME validation (never trust extension or Content-Type) ---
  const detectedMime = detectMimeType(buffer);
  if (!detectedMime) {
    return NextResponse.json(
      { error: "Ungültiges Dateiformat. Nur PNG, JPG und WebP sind erlaubt. Kein SVG." },
      { status: 400 }
    );
  }

  // --- Dimension validation ---
  let meta: Awaited<ReturnType<typeof sharp.prototype.metadata>>;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return NextResponse.json({ error: "Bild konnte nicht gelesen werden." }, { status: 400 });
  }

  if (!meta.width || !meta.height) {
    return NextResponse.json({ error: "Bildabmessungen konnten nicht ermittelt werden." }, { status: 400 });
  }

  if (meta.width < 100 || meta.height < 100) {
    return NextResponse.json(
      { error: `Logo ist zu klein (${meta.width}×${meta.height}px). Mindestgröße: 100×100px.` },
      { status: 400 }
    );
  }

  // --- Process images ---
  const [logoWebp, thumbWebp, favicon32, favicon192] = await Promise.all([
    sharp(buffer).webp().toBuffer(),
    sharp(buffer)
      .resize(200, 200, { fit: "inside", withoutEnlargement: true })
      .webp()
      .toBuffer(),
    sharp(buffer).resize(32, 32).png().toBuffer(),
    sharp(buffer).resize(192, 192).png().toBuffer(),
  ]);

  // --- Supabase Storage upload ---
  const serviceClient = createSupabaseServiceClient();
  const tenantId = claims.tenant_id;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const paths = {
    logo: `branding/${tenantId}/logo.webp`,
    thumb: `branding/${tenantId}/logo-thumb.webp`,
    favicon32: `branding/${tenantId}/favicon-32.png`,
    favicon192: `branding/${tenantId}/favicon-192.png`,
  };

  const uploadResults = await Promise.all([
    serviceClient.storage.from("branding").upload(paths.logo, logoWebp, {
      contentType: "image/webp",
      upsert: true,
    }),
    serviceClient.storage.from("branding").upload(paths.thumb, thumbWebp, {
      contentType: "image/webp",
      upsert: true,
    }),
    serviceClient.storage.from("branding").upload(paths.favicon32, favicon32, {
      contentType: "image/png",
      upsert: true,
    }),
    serviceClient.storage.from("branding").upload(paths.favicon192, favicon192, {
      contentType: "image/png",
      upsert: true,
    }),
  ]);

  for (const { error } of uploadResults) {
    if (error) {
      return NextResponse.json(
        { error: `Speicherfehler: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // --- DB writes (with RLS — use tenant db) ---
  const { db, setJwtClaims } = createTenantDb({
    sub: claims.sub,
    tenant_id: tenantId,
    role: claims.role,
  });
  await setJwtClaims();

  try {
    const [brandingRecord] = await db
      .select({ id: tenantBranding.id, logoFileId: tenantBranding.logoFileId, faviconFileId: tenantBranding.faviconFileId })
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenantId))
      .limit(1);

    if (!brandingRecord) {
      return NextResponse.json({ error: "Branding-Profil nicht gefunden" }, { status: 404 });
    }

    // Soft-delete old files
    const oldFileIds = [brandingRecord.logoFileId, brandingRecord.faviconFileId].filter(Boolean) as string[];
    if (oldFileIds.length > 0) {
      await db
        .update(files)
        .set({ deletedAt: new Date() })
        .where(eq(files.id, oldFileIds[0]!));
    }

    // Insert new file records
    const [logoFileRecord] = await db
      .insert(files)
      .values({
        tenantId,
        entityType: "branding",
        entityId: brandingRecord.id,
        storagePath: paths.logo,
        originalName: logoFile.name,
        mimeType: "image/webp",
        sizeBytes: logoWebp.byteLength,
        width: meta.width,
        height: meta.height,
        kind: "logo",
        isPublic: true,
        processingStatus: "processed",
      })
      .returning({ id: files.id });

    const [faviconFileRecord] = await db
      .insert(files)
      .values({
        tenantId,
        entityType: "branding",
        entityId: brandingRecord.id,
        storagePath: paths.favicon32,
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

    if (!logoFileRecord || !faviconFileRecord) {
      return NextResponse.json({ error: "Datei-Eintrag konnte nicht erstellt werden" }, { status: 500 });
    }

    // Update branding record
    const [currentBranding] = await db
      .select()
      .from(tenantBranding)
      .where(eq(tenantBranding.tenantId, tenantId))
      .limit(1);

    const updatedData = {
      ...currentBranding,
      logoFileId: logoFileRecord.id,
      faviconFileId: faviconFileRecord.id,
    };
    const completeness = calculateCompleteness(updatedData);

    await db
      .update(tenantBranding)
      .set({
        logoFileId: logoFileRecord.id,
        faviconFileId: faviconFileRecord.id,
        completeness,
        updatedAt: new Date(),
      })
      .where(eq(tenantBranding.tenantId, tenantId));

    // Sync compact copy
    const logoPublicUrl = `${supabaseUrl}/storage/v1/object/public/${paths.logo}`;
    await db
      .update(tenants)
      .set({
        branding: {
          primaryColor: currentBranding?.primaryColor ?? "#2563EB",
          tone: currentBranding?.tone ?? "professional",
          formality: currentBranding?.formality ?? "sie",
          descriptionStyle: currentBranding?.descriptionStyle ?? "balanced",
          logoPublicUrl,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      logoFileId: logoFileRecord.id,
      faviconFileId: faviconFileRecord.id,
      logoUrl: logoPublicUrl,
      faviconUrl: `${supabaseUrl}/storage/v1/object/public/${paths.favicon32}`,
    });
  } finally {
    // Note: createTenantDb does not expose cleanup directly here —
    // the postgres client will be GC'd. In production, consider connection pooling.
  }
}
