/**
 * Listings tRPC Router — thin orchestration layer.
 * Business logic lives in listings-service.ts.
 * Spec: MOD_13 Section 6
 */

import { createTRPCRouter, roleProcedure, managerProcedure } from "@/server/trpc/trpc";
import * as listingsService from "../services/listings-service";
import {
  setupConnectionSchema,
  removeConnectionSchema,
  listListingsSchema,
  createListingSchema,
  deactivateListingSchema,
  syncNowSchema,
  getImportSessionSchema,
  confirmImportSchema,
  listInquiriesSchema,
  processInquirySchema,
  getStatsSchema,
} from "../domain/validators";

// Manager+ for connection management and stats; all staff for operational use
const listingsProcedure = roleProcedure(["owner", "admin", "manager", "salesperson"]);

export const listingsRouter = createTRPCRouter({

  // ── Connection management ──────────────────────────────────────────────────

  getConnections: listingsProcedure
    .query(({ ctx }) => listingsService.getConnections(ctx)),

  setupConnection: managerProcedure
    .input(setupConnectionSchema)
    .mutation(({ input, ctx }) => listingsService.setupConnection(input, ctx)),

  removeConnection: managerProcedure
    .input(removeConnectionSchema)
    .mutation(({ input, ctx }) => listingsService.removeConnection(input, ctx)),

  // ── Listings ───────────────────────────────────────────────────────────────

  listListings: listingsProcedure
    .input(listListingsSchema)
    .query(({ input, ctx }) => listingsService.listListings(input, ctx)),

  createListing: listingsProcedure
    .input(createListingSchema)
    .mutation(({ input, ctx }) => listingsService.createListing(input, ctx)),

  deactivateListing: listingsProcedure
    .input(deactivateListingSchema)
    .mutation(({ input, ctx }) => listingsService.deactivateListing(input, ctx)),

  syncNow: listingsProcedure
    .input(syncNowSchema)
    .mutation(({ input, ctx }) => listingsService.syncNow(input, ctx)),

  // ── Import ─────────────────────────────────────────────────────────────────
  // Note: File upload itself goes through /api/upload/boersen-import (multipart).
  // These endpoints handle the confirm step after upload+parse.

  getImportSession: listingsProcedure
    .input(getImportSessionSchema)
    .query(({ input, ctx }) => listingsService.getImportSession(input, ctx)),

  confirmImport: listingsProcedure
    .input(confirmImportSchema)
    .mutation(({ input, ctx }) => listingsService.confirmImport(input, ctx)),

  // ── Inquiries ──────────────────────────────────────────────────────────────

  listInquiries: listingsProcedure
    .input(listInquiriesSchema)
    .query(({ input, ctx }) => listingsService.listInquiries(input, ctx)),

  processInquiry: listingsProcedure
    .input(processInquirySchema)
    .mutation(({ input, ctx }) => listingsService.processInquiry(input, ctx)),

  // ── Stats ──────────────────────────────────────────────────────────────────

  getStats: managerProcedure
    .input(getStatsSchema)
    .query(({ input, ctx }) => listingsService.getStats(input, ctx)),
});
