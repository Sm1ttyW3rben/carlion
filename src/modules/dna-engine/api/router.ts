import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/trpc/trpc";
import {
  updateVisualIdentitySchema,
  updateCommunicationSchema,
  updateBusinessDataSchema,
  startCrawlSchema,
  applyCrawlResultSchema,
  regenerateTextsSchema,
} from "../domain/validators";
import * as dnaService from "../services/dna-service";

export const dnaRouter = createTRPCRouter({
  /**
   * Get current branding profile.
   * All authenticated roles can read branding.
   */
  getBranding: protectedProcedure.query(({ ctx }) =>
    dnaService.getBranding(ctx)
  ),

  /**
   * Update visual identity fields (colors, fonts, border radius, button style).
   * Regenerates color palette if primary/secondary color changes.
   * Syncs tenants.branding compact copy in same transaction.
   */
  updateVisualIdentity: adminProcedure
    .input(updateVisualIdentitySchema)
    .mutation(({ input, ctx }) =>
      dnaService.updateVisualIdentity(input, ctx)
    ),

  /**
   * Update communication identity (tone, formality, dealership type, texts).
   */
  updateCommunicationIdentity: adminProcedure
    .input(updateCommunicationSchema)
    .mutation(({ input, ctx }) =>
      dnaService.updateCommunicationIdentity(input, ctx)
    ),

  /**
   * Update business data (address, phone, email, opening hours, imprint).
   * May advance completeness to branding_complete or publish_ready.
   */
  updateBusinessData: adminProcedure
    .input(updateBusinessDataSchema)
    .mutation(({ input, ctx }) =>
      dnaService.updateBusinessData(input, ctx)
    ),

  /**
   * Start a website crawl. Synchronous — returns result directly, no polling.
   * Timeout cascade: HTTP fetch 8s + AI 10s + total 25s.
   * Spec: MOD_34 Section 5.1
   */
  startCrawl: adminProcedure
    .input(startCrawlSchema)
    .mutation(({ input, ctx }) =>
      dnaService.startCrawl(input.url, ctx)
    ),

  /**
   * Apply a completed crawl result as the active branding.
   * Accepts optional overrides for any section.
   * Marks the crawl as applied.
   */
  applyCrawlResult: adminProcedure
    .input(applyCrawlResultSchema)
    .mutation(({ input, ctx }) =>
      dnaService.applyCrawlResult(input, ctx)
    ),

  /**
   * Regenerate AI texts (tagline, welcome_message, email_signature).
   * Returns suggestions — does NOT save them. Frontend shows preview,
   * user saves via updateCommunicationIdentity.
   */
  regenerateTexts: adminProcedure
    .input(regenerateTextsSchema)
    .mutation(async ({ input, ctx }) => {
      const results = await Promise.all(
        input.fields.map(async (field) => ({
          field,
          text: await dnaService.regenerateText(field, ctx),
        }))
      );
      return Object.fromEntries(results.map(({ field, text }) => [field, text]));
    }),
});
