/**
 * Listings Pull Inquiries Cron Job
 *
 * Polls Börsen APIs for new inquiries and stores them in listing_inquiries.
 * Automatically processes inquiries: creates contacts and deals.
 *
 * Schedule: every 5 minutes (vercel.json)
 * Spec: MOD_13 Section 8
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { runPullInquiries } from "@/modules/listings/services/listings-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPullInquiries(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[listings-pull-inquiries] Error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
