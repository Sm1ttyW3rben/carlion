/**
 * 360dialog API client.
 *
 * All external calls to the WhatsApp Business API go through here.
 * Spec: MOD_17 Section 4.3, 14
 */

import { THREESIXTY_API_BASE, MAX_MEDIA_SIZE_BYTES } from "../domain/constants";

function apiKey(): string {
  const key = process.env.THREESIXTY_API_KEY;
  if (!key) throw new Error("THREESIXTY_API_KEY not set");
  return key;
}

function headers(phoneNumberId?: string): Record<string, string> {
  const h: Record<string, string> = {
    "D360-API-KEY": apiKey(),
    "Content-Type": "application/json",
  };
  if (phoneNumberId) h["X-Phone-Number-Id"] = phoneNumberId;
  return h;
}

// ---------------------------------------------------------------------------
// Send a text message
// ---------------------------------------------------------------------------

export interface SendMessageResult {
  externalMessageId: string;
}

export async function sendTextMessage(
  phoneNumberId: string,
  toPhone: string,
  body: string
): Promise<SendMessageResult> {
  const url = `${THREESIXTY_API_BASE}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers(phoneNumberId),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone.replace("+", ""),
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`360dialog sendMessage failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { messages?: { id: string }[] };
  const msgId = data.messages?.[0]?.id;
  if (!msgId) throw new Error("360dialog returned no message ID");

  return { externalMessageId: msgId };
}

// ---------------------------------------------------------------------------
// Register webhook
// ---------------------------------------------------------------------------

export async function registerWebhook(
  phoneNumberId: string,
  webhookUrl: string
): Promise<void> {
  const url = `${THREESIXTY_API_BASE}/configs/webhook`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers(phoneNumberId),
    body: JSON.stringify({ url: webhookUrl }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`360dialog registerWebhook failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Deregister webhook (best-effort)
// ---------------------------------------------------------------------------

export async function deregisterWebhook(phoneNumberId: string): Promise<void> {
  try {
    const url = `${THREESIXTY_API_BASE}/configs/webhook`;
    await fetch(url, {
      method: "DELETE",
      headers: headers(phoneNumberId),
    });
  } catch {
    // best-effort — do not throw
  }
}

// ---------------------------------------------------------------------------
// Download media from 360dialog
// ---------------------------------------------------------------------------

export async function downloadMedia(
  mediaUrl: string,
  phoneNumberId: string
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const res = await fetch(mediaUrl, {
    headers: { "D360-API-KEY": apiKey(), "X-Phone-Number-Id": phoneNumberId },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Media download failed (${res.status})`);
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_MEDIA_SIZE_BYTES) {
    throw new Error("Media file too large (max 20 MB)");
  }

  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_MEDIA_SIZE_BYTES) {
    throw new Error("Media file too large (max 20 MB)");
  }

  const ext = mimeTypeToExt(mimeType);
  return { buffer: Buffer.from(arrayBuffer), mimeType, ext };
}

function mimeTypeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "video/mp4": "mp4",
  };
  return map[mimeType] ?? "bin";
}

// ---------------------------------------------------------------------------
// Validate webhook signature
// ---------------------------------------------------------------------------

export function validateWebhookSignature(
  payload: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.THREESIXTY_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow in dev, warn in prod
    return process.env.NODE_ENV !== "production";
  }

  if (!signatureHeader) return false;

  // 360dialog sends signature as HMAC-SHA256 hex of the payload
  try {
    const { createHmac } = require("crypto") as typeof import("crypto");
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    // Constant-time comparison
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return require("crypto").timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
