/**
 * Cron: Download WhatsApp media from 360dialog into Supabase Storage.
 *
 * Runs every 2 minutes. 360dialog media URLs are temporary (~30 days).
 * Spec: MOD_17 Section 5 & 9
 */

import { NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { whatsappMessages } from "@/modules/whatsapp/db/schema";
import { whatsappConnections } from "@/modules/whatsapp/db/schema";
import { files } from "@/server/db/schema/files";
import { downloadMedia } from "@/modules/whatsapp/services/threesixty-service";
import { createSupabaseServiceClient } from "@/shared/lib/supabase/server";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Find messages with media_url but no media_file_id
  const pending = await db
    .select()
    .from(whatsappMessages)
    .where(and(
      eq(whatsappMessages.direction, "inbound"),
      // Has media URL
      // No existing file ID
    ))
    .limit(20);

  // Filter in memory (Drizzle doesn't support isNotNull easily for text columns in this pattern)
  const toDownload = pending.filter((m) => m.mediaUrl && !m.mediaFileId);

  let downloaded = 0;
  let errors = 0;

  for (const msg of toDownload) {
    try {
      // Find phone_number_id for this tenant
      const [conn] = await db
        .select({ phoneNumberId: whatsappConnections.phoneNumberId })
        .from(whatsappConnections)
        .where(eq(whatsappConnections.tenantId, msg.tenantId))
        .limit(1);

      if (!conn?.phoneNumberId) continue;

      const { buffer, mimeType, ext } = await downloadMedia(msg.mediaUrl!, conn.phoneNumberId);

      // Upload to Supabase Storage
      const supabase = createSupabaseServiceClient();
      const fileId = crypto.randomUUID();
      const storagePath = `whatsapp/${msg.tenantId}/${msg.conversationId}/${fileId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("private")
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      // Insert files record
      const [fileRecord] = await db
        .insert(files)
        .values({
          tenantId: msg.tenantId,
          entityType: "whatsapp",
          entityId: msg.id,
          storagePath,
          originalName: `${fileId}.${ext}`,
          mimeType,
          sizeBytes: buffer.byteLength,
          kind: mimeType.startsWith("image/") ? "photo" : "document",
          isPublic: false,
          processingStatus: "processed",
        })
        .returning();

      // Update message with file ID
      await db
        .update(whatsappMessages)
        .set({ mediaFileId: fileRecord!.id, updatedAt: new Date() })
        .where(eq(whatsappMessages.id, msg.id));

      downloaded++;
    } catch (err) {
      errors++;
      console.error(`[whatsapp-media-download] Failed msg ${msg.id}:`, err);
    }
  }

  return NextResponse.json({ downloaded, errors, total: toDownload.length });
}
