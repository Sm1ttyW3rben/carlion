/**
 * Listings Reconcile Cron Job
 *
 * Detects vehicle changes and queues outbox entries for Börsen sync.
 * Also cleans up draining connections that have exceeded the drain timeout.
 *
 * Schedule: every 5 minutes (vercel.json)
 * Spec: MOD_13 Section 8
 *       CLAUDE.md Rule 10 (external sends via outbox)
 *       CLAUDE.md Rule 20 (reconciliation cron, no event system)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { runReconcile } from "@/modules/listings/services/listings-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReconcile(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[listings-reconcile] Error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
