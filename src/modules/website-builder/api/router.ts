/**
 * Website Builder tRPC Router — thin orchestration layer.
 * Business logic lives in website-service.ts.
 * Spec: MOD_11 Section 7
 */

import { createTRPCRouter, protectedProcedure, roleProcedure } from "@/server/trpc/trpc";
import * as websiteService from "../services/website-service";
import {
  updateWebsiteSettingsSchema,
  listSubmissionsSchema,
  processSubmissionSchema,
} from "../domain/validators";

const ownerAdminProcedure = roleProcedure(["owner", "admin"]);
const allStaffProcedure = roleProcedure(["owner", "admin", "manager", "salesperson"]);

export const websiteRouter = createTRPCRouter({

  getSettings: protectedProcedure
    .query(({ ctx }) => websiteService.getSettings(ctx)),

  updateSettings: ownerAdminProcedure
    .input(updateWebsiteSettingsSchema)
    .mutation(({ input, ctx }) => websiteService.updateSettings(input, ctx)),

  publish: ownerAdminProcedure
    .mutation(({ ctx }) => websiteService.publish(ctx)),

  unpublish: ownerAdminProcedure
    .mutation(({ ctx }) => websiteService.unpublish(ctx)),

  checkPublishGate: protectedProcedure
    .query(({ ctx }) => websiteService.checkPublishGate(ctx)),

  listSubmissions: allStaffProcedure
    .input(listSubmissionsSchema)
    .query(({ input, ctx }) => websiteService.listSubmissions(input, ctx)),

  processSubmission: allStaffProcedure
    .input(processSubmissionSchema)
    .mutation(({ input, ctx }) => websiteService.processSubmission(input, ctx)),

  getPreviewUrl: ownerAdminProcedure
    .query(({ ctx }) => websiteService.getPreviewUrl(ctx)),
});
