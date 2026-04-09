/**
 * WhatsApp module domain types.
 * Spec: MOD_17 Section 7
 */

import type {
  CONNECTION_STATUS_VALUES,
  MESSAGE_TYPE_VALUES,
  SEND_STATUS_VALUES,
  CONVERSATION_STATUS_VALUES,
} from "./constants";

export type ConnectionStatus = (typeof CONNECTION_STATUS_VALUES)[number];
export type MessageType = (typeof MESSAGE_TYPE_VALUES)[number];
export type SendStatus = (typeof SEND_STATUS_VALUES)[number];
export type ConversationStatus = (typeof CONVERSATION_STATUS_VALUES)[number];

// ---------------------------------------------------------------------------
// View types (API responses)
// ---------------------------------------------------------------------------

export interface ConnectionView {
  id: string;
  displayPhone: string;
  connectionStatus: ConnectionStatus;
  webhookVerified: boolean;
  lastError: string | null;
}

export interface ConversationView {
  id: string;
  contact: {
    id: string;
    displayName: string;
    phone: string | null;
  };
  remotePhone: string;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  replyWindowOpen: boolean;      // computed: replyWindowExpires > now()
  replyWindowExpires: string | null;
  createdAt: string;
}

export interface MessageView {
  id: string;
  direction: "inbound" | "outbound";
  messageType: MessageType;
  body: string | null;
  mediaUrl: string | null;       // resolved Storage URL or 360dialog fallback
  mediaMimeType: string | null;
  sendStatus: SendStatus | null;
  sendError: string | null;
  sentBy: { id: string; name: string } | null;
  timestamp: string;
}

export interface WhatsAppStats {
  totalConversations: number;
  unreadConversations: number;
  messagesToday: number;
  messagesThisWeek: number;
  avgResponseTimeMinutes: number | null;
}
