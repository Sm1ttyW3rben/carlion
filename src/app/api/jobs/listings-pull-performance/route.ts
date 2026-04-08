/**
 * Listings Pull Performance Cron Job
 *
 * Fetches view/click/inquiry counters from Börsen APIs for all active listings
 * and updates the performance columns in the listings table.
 *
 * Schedule: every 2 hours (vercel.json)
 * Spec: MOD_13 Section 8
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { runPullPerformance } from "@/modules/listings/services/listings-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPullPerformance(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[listings-pull-performance] Error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
