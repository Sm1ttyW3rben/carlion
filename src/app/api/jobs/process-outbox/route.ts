/**
 * Process Outbox Cron Job
 *
 * Dispatches pending outbox entries for all services.
 * Currently handles: boersen_sync (Börsen API calls)
 *
 * Architecture: Outbox pattern — external sends are never made directly from mutations.
 * This worker reads pending entries and executes them, with retry on failure.
 *
 * Schedule: every minute (vercel.json)
 * Spec: MOD_13 Section 8
 *       01_ARCHITECTURE.md Section 8 (Outbox pattern)
 *       CLAUDE.md Rule 10 (external sends via outbox)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, lte, lt, isNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import { outbox } from "@/server/db/schema/outbox";
import { processOutboxEntry } from "@/modules/listings/services/listings-service";

const MAX_BATCH_SIZE = 20;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Fetch a batch of pending outbox entries that are ready to process
  const entries = await db
    .select()
    .from(outbox)
    .where(
      and(
        eq(outbox.status, "pending"),
        lt(outbox.attempts, outbox.maxAttempts),
        or(
          isNull(outbox.nextAttemptAt),
          lte(outbox.nextAttemptAt, now)
        )
      )
    )
    .limit(MAX_BATCH_SIZE);

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  // Mark as processing to prevent double-processing
  const ids = entries.map((e) => e.id);
  await db
    .update(outbox)
    .set({ status: "processing" })
    .where(eq(outbox.status, "pending"));

  let processed = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      if (entry.service === "boersen_sync") {
        await processOutboxEntry(entry, db);
      }
      // Other services (email, whatsapp) dispatched here when those modules are built

      await db
        .update(outbox)
        .set({
          status: "sent",
          processedAt: new Date(),
          attempts: entry.attempts + 1,
        })
        .where(eq(outbox.id, entry.id));

      processed++;
    } catch (error) {
      const nextAttempts = entry.attempts + 1;
      const maxAttempts = entry.maxAttempts;
      // Exponential backoff: 2min, 10min, 60min
      const backoffMs = [2 * 60_000, 10 * 60_000, 60 * 60_000][Math.min(nextAttempts - 1, 2)] ?? 60 * 60_000;
      const nextAttemptAt = new Date(Date.now() + backoffMs);

      await db
        .update(outbox)
        .set({
          status: nextAttempts >= maxAttempts ? "failed" : "pending",
          attempts: nextAttempts,
          nextAttemptAt: nextAttempts >= maxAttempts ? null : nextAttemptAt,
          errorMessage: (error as Error).message,
        })
        .where(eq(outbox.id, entry.id));

      console.error(`[process-outbox] Entry ${entry.id} (${entry.service}/${entry.action}) failed:`, error);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed, failed });
}
