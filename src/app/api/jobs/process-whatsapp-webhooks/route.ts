/**
 * Cron: Process unprocessed WhatsApp webhook_log entries.
 *
 * Runs every minute as fallback for failed fast-path processing.
 * Spec: MOD_17 Section 5 & 9
 */

import { NextResponse } from "next/server";
import { eq, and, isNull, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { webhookLog } from "@/server/db/schema/webhook-log";
import { processWebhookEntry } from "@/modules/whatsapp/services/whatsapp-service";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Find unprocessed entries older than 10 seconds (fast-path had time to try)
  const cutoff = new Date(Date.now() - 10_000);

  const entries = await db
    .select()
    .from(webhookLog)
    .where(and(
      eq(webhookLog.processed, false),
      eq(webhookLog.service, "threesixty"),
      lt(webhookLog.receivedAt, cutoff)
    ))
    .limit(50);

  let processed = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      await processWebhookEntry(entry, db);
      processed++;
    } catch (err) {
      errors++;
      console.error(`[process-whatsapp-webhooks] Failed entry ${entry.id}:`, err);
      await db
        .update(webhookLog)
        .set({ errorMessage: err instanceof Error ? err.message : String(err) })
        .where(eq(webhookLog.id, entry.id));
    }
  }

  return NextResponse.json({ processed, errors, total: entries.length });
}
