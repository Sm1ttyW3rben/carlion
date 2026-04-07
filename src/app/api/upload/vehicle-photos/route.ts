/**
 * Vehicle Photos Upload Handler
 *
 * Handles multipart/form-data uploads.
 * tRPC cannot handle multipart — this is a dedicated Route Handler.
 * Spec: MOD_02 Section 5 — inventory.uploadPhotos
 *       01_ARCHITECTURE.md Section 7 (File Storage)
 *       01_ARCHITECTURE.md Rule 13 (File uploads via Route Handlers)
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/shared/lib/supabase/server";
import { createTenantDb } from "@/server/db/create-tenant-db";
import { files } from "@/server/db/schema/files";
import { vehicles } from "@/modules/inventory/db/schema";
import { eq, and, isNull, count } from "drizzle-orm";
import { callClaude } from "@/shared/lib/ai";
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_VEHICLE,
} from "@/modules/inventory/domain/constants";

interface JwtClaims {
  sub: string;
  tenant_id: string;
  role: string;
}

const EDITOR_ROLES = ["owner", "admin", "manager", "salesperson"];

/** Decodes JWT payload without verification */
function decodeJwtClaims(token: string): JwtClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload) as JwtClaims;
  } catch {
    return null;
  }
}

/** Generates an AI alt-text for a vehicle photo. Returns null on failure (non-blocking). */
async function generateAltText(
  photoBuffer: Buffer,
  vehicleMake: string,
  vehicleModel: string
): Promise<string | null> {
  try {
    // Convert to base64 for AI vision — Claude doesn't do image vision in this flow,
    // so we generate a descriptive alt text from the vehicle info instead.
    const altText = await callClaude({
      systemPrompt:
        "Du generierst präzise, kurze Alt-Texte für Fahrzeugfotos in einer Fahrzeugbörse. Antworte nur mit dem Alt-Text, ohne Anführungszeichen.",
      userPrompt: `Generiere einen kurzen Alt-Text (max. 10 Wörter) für ein Foto eines ${vehicleMake} ${vehicleModel}.`,
      maxTokens: 50,
    });
    return altText.trim().slice(0, 200);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });
  }

  const claims = decodeJwtClaims(session.access_token);
  if (!claims?.tenant_id || !claims?.sub) {
    return NextResponse.json({ error: "Ungültiger Token." }, { status: 401 });
  }

  if (!EDITOR_ROLES.includes(claims.role)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  // ---------------------------------------------------------------------------
  // Parse multipart form data
  // ---------------------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const vehicleId = formData.get("vehicleId");
  if (!vehicleId || typeof vehicleId !== "string") {
    return NextResponse.json({ error: "vehicleId ist erforderlich." }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Create RLS-enabled DB client & verify vehicle ownership
  // ---------------------------------------------------------------------------
  const { db, setJwtClaims, cleanup } = createTenantDb({
    sub: claims.sub,
    tenant_id: claims.tenant_id,
    role: claims.role,
  });

  try {
    await setJwtClaims();

    const [vehicle] = await db
      .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(
        and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.tenantId, claims.tenant_id),
          isNull(vehicles.deletedAt)
        )
      )
      .limit(1);

    if (!vehicle) {
      return NextResponse.json({ error: "Fahrzeug nicht gefunden." }, { status: 404 });
    }

    // ---------------------------------------------------------------------------
    // Check current photo count (max 30)
    // ---------------------------------------------------------------------------
    const countRows = await db
      .select({ value: count() })
      .from(files)
      .where(
        and(
          eq(files.entityType, "vehicle"),
          eq(files.entityId, vehicleId),
          isNull(files.deletedAt)
        )
      );
    const existingCount = countRows[0]?.value ?? 0;

    const uploadedFiles = formData.getAll("files") as File[];
    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: "Keine Dateien hochgeladen." }, { status: 400 });
    }

    if ((existingCount + uploadedFiles.length) > MAX_PHOTOS_PER_VEHICLE) {
      return NextResponse.json(
        { error: `Maximal ${MAX_PHOTOS_PER_VEHICLE} Fotos pro Fahrzeug erlaubt.` },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------------------
    // Process each file
    // ---------------------------------------------------------------------------
    const storageClient = createSupabaseServiceClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const results = [];

    for (const file of uploadedFiles) {
      // MIME type validation (server-side — never trust extension)
      if (!(ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
        results.push({ error: `Ungültiger Dateityp: ${file.type}` });
        continue;
      }

      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        results.push({ error: `Datei zu groß: ${file.name} (max. 10 MB)` });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Validate image via sharp
      let metadata: sharp.Metadata;
      try {
        metadata = await sharp(buffer).metadata();
      } catch {
        results.push({ error: `Ungültige Bilddatei: ${file.name}` });
        continue;
      }

      if (!metadata.width || !metadata.height) {
        results.push({ error: `Bild konnte nicht gelesen werden: ${file.name}` });
        continue;
      }

      // Determine next position
      const posRows = await db
        .select({ value: count() })
        .from(files)
        .where(
          and(
            eq(files.entityType, "vehicle"),
            eq(files.entityId, vehicleId),
            isNull(files.deletedAt)
          )
        );
      const nextPos = posRows[0]?.value ?? 0;
      const position = nextPos + 1;

      // Process images
      const [
        originalWebp,
        thumbnailList,   // 200x150
        thumbnailDetail, // 800x600
      ] = await Promise.all([
        sharp(buffer).webp({ quality: 85 }).toBuffer(),
        sharp(buffer).resize(200, 150, { fit: "cover" }).webp({ quality: 80 }).toBuffer(),
        sharp(buffer).resize(800, 600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      ]);

      const fileId = crypto.randomUUID();
      const basePath = `vehicles/${claims.tenant_id}/${vehicleId}/${fileId}`;
      const publicBasePath = `vehicles-public/${claims.tenant_id}/${vehicleId}/${fileId}`;

      // Upload all variants
      await Promise.all([
        storageClient.storage.from("vehicles").upload(`${basePath}.webp`, originalWebp, {
          contentType: "image/webp",
          upsert: false,
        }),
        storageClient.storage.from("vehicles-public").upload(`${publicBasePath}-list.webp`, thumbnailList, {
          contentType: "image/webp",
          upsert: false,
        }),
        storageClient.storage.from("vehicles-public").upload(`${publicBasePath}-detail.webp`, thumbnailDetail, {
          contentType: "image/webp",
          upsert: false,
        }),
      ]);

      // Insert original file record
      const [fileRecord] = await db
        .insert(files)
        .values({
          tenantId: claims.tenant_id,
          entityType: "vehicle",
          entityId: vehicleId,
          storagePath: `vehicles/${claims.tenant_id}/${vehicleId}/${fileId}.webp`,
          originalName: file.name,
          mimeType: "image/webp",
          sizeBytes: originalWebp.byteLength,
          width: metadata.width,
          height: metadata.height,
          kind: "photo",
          position,
          isPublic: false, // set to true on publish
          processingStatus: "processed",
        })
        .returning();

      // Insert thumbnail_list record
      await db.insert(files).values({
        tenantId: claims.tenant_id,
        entityType: "vehicle",
        entityId: vehicleId,
        storagePath: `vehicles-public/${claims.tenant_id}/${vehicleId}/${fileId}-list.webp`,
        originalName: `${file.name}-thumb-list`,
        mimeType: "image/webp",
        sizeBytes: thumbnailList.byteLength,
        width: 200,
        height: 150,
        kind: "thumbnail_list",
        position,
        isPublic: false,
        processingStatus: "processed",
      });

      // Insert thumbnail_detail record
      await db.insert(files).values({
        tenantId: claims.tenant_id,
        entityType: "vehicle",
        entityId: vehicleId,
        storagePath: `vehicles-public/${claims.tenant_id}/${vehicleId}/${fileId}-detail.webp`,
        originalName: `${file.name}-thumb-detail`,
        mimeType: "image/webp",
        sizeBytes: thumbnailDetail.byteLength,
        width: 800,
        height: 600,
        kind: "thumbnail_detail",
        position,
        isPublic: false,
        processingStatus: "processed",
      });

      // Non-blocking AI alt-text generation
      generateAltText(thumbnailList, vehicle.make, vehicle.model)
        .then(async (altText) => {
          if (altText && fileRecord) {
            const { db: bgDb, setJwtClaims: bgSetClaims, cleanup: bgCleanup } = createTenantDb({
              sub: claims.sub,
              tenant_id: claims.tenant_id,
              role: claims.role,
            });
            await bgSetClaims();
            await bgDb.update(files).set({ altText }).where(eq(files.id, fileRecord.id));
            await bgCleanup();
          }
        })
        .catch(() => {}); // Never block upload on AI failure

      if (fileRecord) {
        results.push({
          id: fileRecord.id,
          url: `${supabaseUrl}/storage/v1/object/public/vehicles/${claims.tenant_id}/${vehicleId}/${fileId}.webp`,
          position,
          kind: "photo",
        });
      }
    }

    return NextResponse.json({ uploaded: results });
  } finally {
    await cleanup();
  }
}
