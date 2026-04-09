/**
 * WhatsApp Module — Public Exports
 *
 * Other modules MUST only access WhatsApp data via these exports.
 * Never import directly from internal module files.
 *
 * Spec: MOD_17 Section 10
 */

// DB tables — for cross-module FK references only
export { whatsappConnections, whatsappConversations, whatsappMessages } from "./db/schema";

// Cross-module service functions
export {
  getConversationForContact,
  getUnreadCount,
} from "./services/whatsapp-service";

// Types needed by consumers
export type {
  ConversationView,
  MessageView,
  ConnectionView,
  WhatsAppStats,
} from "./domain/types";

// AI tools
export { whatsappTools } from "./ai-tools";
