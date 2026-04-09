/**
 * WhatsApp tRPC Router — thin orchestration layer.
 * Business logic lives in whatsapp-service.ts.
 * Spec: MOD_17 Section 7
 */

import { createTRPCRouter, roleProcedure } from "@/server/trpc/trpc";
import * as whatsappService from "../services/whatsapp-service";
import {
  setupConnectionSchema,
  listConversationsSchema,
  getMessagesSchema,
  sendMessageSchema,
  retryMessageSchema,
  markAsReadSchema,
  archiveConversationSchema,
} from "../domain/validators";

const ownerAdminProcedure = roleProcedure(["owner", "admin"]);
const allStaffProcedure = roleProcedure(["owner", "admin", "manager", "salesperson"]);
const managerProcedure = roleProcedure(["owner", "admin", "manager"]);

export const whatsappRouter = createTRPCRouter({

  getConnection: ownerAdminProcedure
    .query(({ ctx }) => whatsappService.getConnection(ctx)),

  setupConnection: ownerAdminProcedure
    .input(setupConnectionSchema)
    .mutation(({ input, ctx }) => whatsappService.setupConnection(input, ctx)),

  removeConnection: ownerAdminProcedure
    .mutation(({ ctx }) => whatsappService.removeConnection(ctx)),

  listConversations: allStaffProcedure
    .input(listConversationsSchema)
    .query(({ input, ctx }) => whatsappService.listConversations(input, ctx)),

  getMessages: allStaffProcedure
    .input(getMessagesSchema)
    .query(({ input, ctx }) => whatsappService.getMessages(input, ctx)),

  sendMessage: allStaffProcedure
    .input(sendMessageSchema)
    .mutation(({ input, ctx }) => whatsappService.sendMessage(input, ctx)),

  retryMessage: allStaffProcedure
    .input(retryMessageSchema)
    .mutation(({ input, ctx }) => whatsappService.retryMessage(input, ctx)),

  markAsRead: allStaffProcedure
    .input(markAsReadSchema)
    .mutation(({ input, ctx }) => whatsappService.markAsRead(input, ctx)),

  archiveConversation: managerProcedure
    .input(archiveConversationSchema)
    .mutation(({ input, ctx }) => whatsappService.archiveConversation(input, ctx)),

  getStats: managerProcedure
    .query(({ ctx }) => whatsappService.getStats(ctx)),
});
