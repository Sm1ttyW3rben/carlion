/**
 * 360dialog Webhook Handler
 *
 * Architecture (CLAUDE.md Rule 12):
 * 1. Signature validate → 401 if invalid
 * 2. webhook_log INSERT (idempotent via event_id)
 * 3. HTTP 200 immediately
 * 4. Fast-path: attempt processing in same request (best-effort)
 * 5. Cron fallback: /api/jobs/process-whatsapp-webhooks (1 min)
 *
 * Spec: MOD_17 Section 5
 */

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { webhookLog } from "@/server/db/schema/webhook-log";
import { validateWebhookSignature } from "@/modules/whatsapp/services/threesixty-service";
import { processWebhookEntry } from "@/modules/whatsapp/services/whatsapp-service";
import { eq } from "drizzle-orm";

// GET: 360dialog webhook verification
export async function GET(req: Request) {
  const url = new URL(req.url);
  const hubChallenge = url.searchParams.get("hub.challenge");
  if (hubChallenge) {
    return new Response(hubChallenge, { status: 200 });
  }
  return new Response("OK", { status: 200 });
}

export async function POST(req: Request) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // 1. Validate signature
  const signature = req.headers.get("D360-Signature") ?? req.headers.get("X-360dialog-Signature");
  if (!validateWebhookSignature(rawBody, signature)) {
    console.warn("[threesixty] Webhook signature invalid");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2. Extract event IDs for deduplication
  // 360dialog sends messages with their own IDs; use first message ID or generate
  const payloadObj = payload as Record<string, unknown>;
  const messages = (payloadObj.messages as Array<{ id?: string }> | undefined) ?? [];
  const statuses = (payloadObj.statuses as Array<{ id?: string }> | undefined) ?? [];
  const eventId = messages[0]?.id ?? statuses[0]?.id ?? null;

  // Check for duplicate
  if (eventId) {
    const existing = await db
      .select({ id: webhookLog.id })
      .from(webhookLog)
      .where(eq(webhookLog.eventId, eventId))
      .limit(1);
    if (existing.length > 0) {
      // Already processed or in queue
      return NextResponse.json({ ok: true });
    }
  }

  // 3. Log webhook (before returning 200)
  const [entry] = await db
    .insert(webhookLog)
    .values({
      eventId,
      service: "threesixty",
      payload: payload as Record<string, unknown>,
      processed: false,
    })
    .returning();

  // 4. Return 200 immediately
  const response = NextResponse.json({ ok: true });

  // 5. Fast-path: process in background (after response is sent)
  // Using void to not await the response
  if (entry) {
    void (async () => {
      try {
        await processWebhookEntry(entry, db);
      } catch (err) {
        console.error("[threesixty] Fast-path processing failed:", err);
        // Cron will retry
      }
    })();
  }

  return response;
}
