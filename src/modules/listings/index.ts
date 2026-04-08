/**
 * Listings Module — Public Exports
 *
 * Other modules MUST only access listings data via these exports.
 * Never import directly from internal module files.
 *
 * Spec: MOD_13 Section 10
 */

// Drizzle tables — for cross-module FK references and JOIN queries only
export { listings, listingInquiries } from "./db/schema";

// Service functions for inter-module consumption
export {
  getListingsForVehicle,
  getUnprocessedInquiriesCount,
} from "./services/listings-service";

// Types needed by consumers
export type {
  Platform,
  SyncStatus,
  ConnectionView,
  ListingView,
  InquiryView,
  ImportSessionView,
  ListingsStats,
  VehicleImportRow,
  ParseResult,
  ParseError,
  ParseWarning,
  BoerenSyncPayload,
} from "./domain/types";

// AI tools (aggregated by server/trpc/ai-tools.ts when assistant module is built)
export { listingsTools } from "./ai-tools";
