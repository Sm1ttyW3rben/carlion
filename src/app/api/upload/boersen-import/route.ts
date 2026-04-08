/**
 * Börsen Import Upload Handler
 *
 * Accepts a mobile.de or AutoScout24 export file (CSV or XML),
 * parses it server-side, stores the result in import_sessions,
 * and returns the session ID for the client to confirm.
 *
 * tRPC cannot handle multipart — this is a dedicated Route Handler.
 * Spec: MOD_13 Section 5
 *       CLAUDE.md Rule 13 (File uploads via Route Handlers)
 *       CLAUDE.md Rule 14 (Import-Idempotenz)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createTenantDb } from "@/server/db/create-tenant-db";
import { importSessions } from "@/modules/listings/db/schema";
import {
  parseMobileDeExport,
  parseAutoScout24Export,
  detectFormat,
} from "@/server/services/boersen-parser";
import { IMPORT_SESSION_TTL_MS, PLATFORM_VALUES } from "@/modules/listings/domain/constants";

interface JwtClaims {
  sub: string;
  tenant_id: string;
  role: string;
}

const ALLOWED_ROLES = ["owner", "admin", "manager", "salesperson"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ["text/csv", "text/xml", "application/xml", "text/plain"];

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

  if (!ALLOWED_ROLES.includes(claims.role)) {
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

  const platform = formData.get("platform");
  if (!platform || typeof platform !== "string" || !PLATFORM_VALUES.includes(platform as never)) {
    return NextResponse.json(
      { error: "platform ist erforderlich: 'mobile_de' oder 'autoscout24'" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Datei ist erforderlich." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß. Maximum: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB` },
      { status: 400 }
    );
  }

  // Accept CSV and XML (also text/plain for browsers that misdetect)
  if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== "") {
    return NextResponse.json(
      { error: "Ungültiger Dateityp. CSV oder XML erwartet." },
      { status: 400 }
    );
  }

  // ---------------------------------------------------------------------------
  // Read and parse file
  // ---------------------------------------------------------------------------
  let content: string;
  try {
    const buffer = await file.arrayBuffer();
    // mobile.de uses ISO-8859-1; AutoScout24 uses UTF-8
    if (platform === "mobile_de") {
      content = new TextDecoder("iso-8859-1").decode(buffer);
    } else {
      content = new TextDecoder("utf-8").decode(buffer);
    }
  } catch {
    return NextResponse.json({ error: "Datei konnte nicht gelesen werden." }, { status: 400 });
  }

  let parseResult;
  try {
    if (platform === "mobile_de") {
      parseResult = parseMobileDeExport(content);
    } else {
      const format = detectFormat(content);
      parseResult = parseAutoScout24Export(content, format);
    }
  } catch {
    return NextResponse.json({ error: "Datei konnte nicht geparst werden." }, { status: 422 });
  }

  // ---------------------------------------------------------------------------
  // Store import session (server-side — no client trust)
  // ---------------------------------------------------------------------------
  const { db, setJwtClaims, cleanup } = createTenantDb({
    sub: claims.sub,
    tenant_id: claims.tenant_id,
    role: claims.role,
  });

  try {
    await setJwtClaims();

    const expiresAt = new Date(Date.now() + IMPORT_SESSION_TTL_MS);

    const [session] = await db
      .insert(importSessions)
      .values({
        tenantId: claims.tenant_id,
        platform,
        parsedVehicles: parseResult.vehicles,
        parseErrors: parseResult.errors,
        parseWarnings: parseResult.warnings,
        vehicleCount: parseResult.vehicles.length,
        duplicateCount: 0, // Will be computed by confirmImport
        originalFilename: file.name,
        expiresAt,
      })
      .returning({ id: importSessions.id });

    return NextResponse.json({
      importSessionId: session!.id,
      platform,
      vehicleCount: parseResult.vehicles.length,
      errorCount: parseResult.errors.length,
      warningCount: parseResult.warnings.length,
      errors: parseResult.errors,
      warnings: parseResult.warnings,
    });
  } finally {
    await cleanup();
  }
}
