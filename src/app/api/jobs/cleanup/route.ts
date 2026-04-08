/**
 * Cleanup Cron Job
 *
 * Housekeeping tasks:
 * - Expire stale import sessions (TTL exceeded)
 * - Mark failed outbox entries after max retries (handled by process-outbox)
 *
 * Schedule: daily at 03:00 UTC (vercel.json)
 * Spec: MOD_13 Section 8
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { runCleanup } from "@/modules/listings/services/listings-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCleanup(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cleanup] Error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
