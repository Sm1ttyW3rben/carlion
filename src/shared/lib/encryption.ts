/**
 * AES-256-GCM encryption utility for sensitive fields (API keys, credentials).
 *
 * Env: APP_ENCRYPTION_KEY — 64-char hex string (32 bytes).
 * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Format on disk: base64(iv[12] + authTag[16] + ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). " +
        "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
