/**
 * WhatsApp module constants.
 * Spec: MOD_17
 */

export const CONNECTION_STATUS_VALUES = ["disconnected", "connected", "error"] as const;
export const MESSAGE_TYPE_VALUES = ["text", "image", "document", "audio", "video", "location", "contact", "sticker", "unknown"] as const;
export const SEND_STATUS_VALUES = ["sending", "sent", "delivered", "read", "failed"] as const;
export const CONVERSATION_STATUS_VALUES = ["active", "archived"] as const;

// 24-hour reply window in milliseconds
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Pagination defaults
export const DEFAULT_CONVERSATIONS_LIMIT = 30;
export const MAX_CONVERSATIONS_LIMIT = 100;
export const DEFAULT_MESSAGES_LIMIT = 50;
export const MAX_MESSAGES_LIMIT = 200;

// Message constraints
export const MAX_MESSAGE_BODY = 4096;

// Media download
export const MAX_MEDIA_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "audio/ogg", "audio/mpeg",
  "video/mp4",
];

// 360dialog base URL
export const THREESIXTY_API_BASE = "https://waba.360dialog.io/v1";
