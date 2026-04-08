/**
 * Contact Form Submission Route
 *
 * The ONLY public write path for the website.
 * Validates, spam-checks, and stores contact form submissions.
 *
 * IMPORTANT: Write paths go under /api/forms/, NOT /api/public/
 * (CLAUDE.md Rule 11)
 *
 * Spec: MOD_11 Section 6 (Kontaktformular-Submission)
 *       CLAUDE.md Rule 11 (public write paths under /api/forms/)
 *       CLAUDE.md Rule 14 (rate limiting, honeypot)
 *
 * POST /api/forms/[tenant_slug]/contact
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { saveContactSubmission } from "@/modules/website-builder";
import { contactFormSchema } from "@/modules/website-builder/domain/validators";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant_slug: string }> }
) {
  const { tenant_slug } = await params;

  if (!tenant_slug || typeof tenant_slug !== "string") {
    return NextResponse.json({ error: "Ungültiger Tenant-Slug" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const parseResult = contactFormSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parseResult.error.flatten() },
      { status: 422 }
    );
  }

  const { name, email, phone, message, vehicleId, honeypot } = parseResult.data;

  // Extract IP for rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;

  const result = await saveContactSubmission(
    tenant_slug,
    { name, email, phone, message, vehicleId, ipAddress: ip, honeypot },
    db
  );

  if (!result.ok) {
    // Either rate-limited, honeypot triggered, or website not accepting forms.
    // Always return 200 to bots so they don't retry.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
