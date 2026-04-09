/**
 * WhatsApp module input validators (Zod).
 * Spec: MOD_17 Section 7
 */

import { z } from "zod";
import { MAX_CONVERSATIONS_LIMIT, MAX_MESSAGES_LIMIT, MAX_MESSAGE_BODY, DEFAULT_CONVERSATIONS_LIMIT, DEFAULT_MESSAGES_LIMIT } from "./constants";

export const setupConnectionSchema = z.object({
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
  displayPhone: z.string().min(1),
});

export const listConversationsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_CONVERSATIONS_LIMIT).default(DEFAULT_CONVERSATIONS_LIMIT),
  status: z.enum(["active", "archived"]).optional(),
  unreadOnly: z.boolean().optional(),
  search: z.string().optional(),
});

export const getMessagesSchema = z.object({
  conversationId: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_MESSAGES_LIMIT).default(DEFAULT_MESSAGES_LIMIT),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(MAX_MESSAGE_BODY),
});

export const retryMessageSchema = z.object({
  messageId: z.string().uuid(),
});

export const markAsReadSchema = z.object({
  conversationId: z.string().uuid(),
});

export const archiveConversationSchema = z.object({
  conversationId: z.string().uuid(),
});

export type SetupConnectionInput = z.infer<typeof setupConnectionSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type RetryMessageInput = z.infer<typeof retryMessageSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type ArchiveConversationInput = z.infer<typeof archiveConversationSchema>;
