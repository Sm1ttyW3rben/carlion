import { z } from "zod";
import { PLATFORM_VALUES, SYNC_STATUS_VALUES, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./constants";

const platformSchema = z.enum(PLATFORM_VALUES);
const syncStatusSchema = z.enum(SYNC_STATUS_VALUES);

// ---------------------------------------------------------------------------
// listings.getConnections — no input
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// listings.setupConnection
// ---------------------------------------------------------------------------

export const setupConnectionSchema = z.object({
  platform: platformSchema,
  apiKey: z.string().min(1, "API-Key darf nicht leer sein"),
  dealerId: z.string().min(1, "Händler-ID darf nicht leer sein"),
});

export type SetupConnectionInput = z.infer<typeof setupConnectionSchema>;

// ---------------------------------------------------------------------------
// listings.removeConnection
// ---------------------------------------------------------------------------

export const removeConnectionSchema = z.object({
  connectionId: z.string().uuid(),
});

export type RemoveConnectionInput = z.infer<typeof removeConnectionSchema>;

// ---------------------------------------------------------------------------
// listings.listListings
// ---------------------------------------------------------------------------

export const listListingsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  platform: platformSchema.optional(),
  syncStatus: syncStatusSchema.optional(),
  vehicleId: z.string().uuid().optional(),
  sortBy: z.enum(["created_at", "views_total", "inquiries_total"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListListingsInput = z.infer<typeof listListingsSchema>;

// ---------------------------------------------------------------------------
// listings.createListing
// ---------------------------------------------------------------------------

export const createListingSchema = z.object({
  vehicleId: z.string().uuid(),
  platform: platformSchema,
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

// ---------------------------------------------------------------------------
// listings.deactivateListing
// ---------------------------------------------------------------------------

export const deactivateListingSchema = z.object({
  listingId: z.string().uuid(),
});

export type DeactivateListingInput = z.infer<typeof deactivateListingSchema>;

// ---------------------------------------------------------------------------
// listings.syncNow
// ---------------------------------------------------------------------------

export const syncNowSchema = z.object({
  listingId: z.string().uuid(),
});

export type SyncNowInput = z.infer<typeof syncNowSchema>;

// ---------------------------------------------------------------------------
// listings.getImportSession
// ---------------------------------------------------------------------------

export const getImportSessionSchema = z.object({
  importSessionId: z.string().uuid(),
});

export type GetImportSessionInput = z.infer<typeof getImportSessionSchema>;

// ---------------------------------------------------------------------------
// listings.confirmImport
// ---------------------------------------------------------------------------

export const confirmImportSchema = z.object({
  importSessionId: z.string().uuid(),
});

export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;

// ---------------------------------------------------------------------------
// listings.listInquiries
// ---------------------------------------------------------------------------

export const listInquiriesSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  platform: platformSchema.optional(),
  processed: z.boolean().optional(),
  vehicleId: z.string().uuid().optional(),
});

export type ListInquiriesInput = z.infer<typeof listInquiriesSchema>;

// ---------------------------------------------------------------------------
// listings.processInquiry
// ---------------------------------------------------------------------------

export const processInquirySchema = z.object({
  inquiryId: z.string().uuid(),
});

export type ProcessInquiryInput = z.infer<typeof processInquirySchema>;

// ---------------------------------------------------------------------------
// listings.getStats
// ---------------------------------------------------------------------------

export const getStatsSchema = z.object({
  platform: platformSchema.optional(),
});

export type GetStatsInput = z.infer<typeof getStatsSchema>;
