/**
 * WhatsApp AI Tools — for the AI assistant module.
 *
 * Read tools: list conversations, get messages, stats.
 * Write tools: propose_whatsapp_reply (PROPOSE → CONFIRM, never auto-reply).
 * Spec: MOD_17 Section 8
 */

import type { AiTool } from "@/modules/dna-engine/domain/types";
import type { TrpcContext } from "@/server/trpc/context";
import * as whatsappService from "./services/whatsapp-service";

export const whatsappTools: AiTool<unknown>[] = [
  // ---------------------------------------------------------------------------
  // Read tools
  // ---------------------------------------------------------------------------
  {
    name: "list_whatsapp_conversations",
    description: "WhatsApp-Konversationen auflisten. Gibt aktive Konversationen zurück, optional gefiltert nach ungelesen oder Kontaktname.",
    type: "read",
    parameters: {
      type: "object",
      properties: {
        unread_only: { type: "boolean", description: "Nur ungelesene Konversationen" },
        search: { type: "string", description: "Suche nach Kontaktname oder Telefonnummer" },
      },
    },
    execute: async (params, ctx) => {
      const p = params as { unread_only?: boolean; search?: string };
      return whatsappService.listConversations(
        { limit: 20, unreadOnly: p.unread_only, search: p.search },
        ctx as unknown as TrpcContext
      );
    },
  },
  {
    name: "get_whatsapp_messages",
    description: "Nachrichten einer WhatsApp-Konversation abrufen. Suche über Konversations-ID oder Kontaktname.",
    type: "read",
    parameters: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID der Konversation" },
        contact_name: { type: "string", description: "Name des Kontakts für Suche" },
      },
    },
    execute: async (params, ctx) => {
      const p = params as { conversation_id?: string; contact_name?: string };
      return whatsappService.getMessagesByContactOrId(
        { conversationId: p.conversation_id, contactName: p.contact_name },
        ctx as unknown as TrpcContext
      );
    },
  },
  {
    name: "get_whatsapp_stats",
    description: "WhatsApp-Statistiken abrufen: Konversationen, ungelesen, Nachrichten heute/Woche.",
    type: "read",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (_params, ctx) => {
      return whatsappService.getStats(ctx as unknown as TrpcContext);
    },
  },

  // ---------------------------------------------------------------------------
  // Write tools — PROPOSE → CONFIRM only, never auto-reply
  // ---------------------------------------------------------------------------
  {
    name: "propose_whatsapp_reply",
    description: `WhatsApp-Antwort vorschlagen (PROPOSE-Flow).
Der Händler sieht den Vorschlag und bestätigt ihn per Klick — KEIN Auto-Reply.
Verwende dieses Tool wenn der Händler z.B. sagt: "Antworte Herrn Müller dass der BMW noch verfügbar ist."`,
    type: "write",
    parameters: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID der Konversation" },
        body: { type: "string", description: "Vorgeschlagener Antworttext (max 4096 Zeichen)" },
      },
      required: ["conversation_id", "body"],
    },
    execute: async (params, _ctx) => {
      const p = params as { conversation_id: string; body: string };
      // Returns a proposal object — the AI assistant module handles PROPOSE → CONFIRM
      return {
        __type: "proposal",
        module: "whatsapp",
        action: "send_message",
        conversationId: p.conversation_id,
        proposedChanges: { body: p.body },
        preview: `Antwort: "${p.body.slice(0, 120)}${p.body.length > 120 ? "…" : ""}"`,
        requiresConfirmation: true,
      };
    },
  },
];
