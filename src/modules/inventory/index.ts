/**
 * Inventory Module — Public Exports
 *
 * Other modules MUST only access inventory data via these exports.
 * Never import directly from internal module files.
 *
 * Spec: MOD_02 Section 10
 */

// Service functions for inter-module consumption
export {
  getVehicleById,
  getVehiclesForTenant,
  getPublicVehiclesForSlug,
  bulkUpsertVehicles,
  markVehicleAsSold,
  releaseVehicleReservation,
} from "./services/inventory-service";

// Types needed by consumers
export type {
  VehicleRecord,
  VehicleView,
  VehicleViewRestricted,
  VehicleListItem,
  PublicVehicle,
  VehicleStatus,
  VehicleSource,
  VehicleTaxType,
  FileReference,
  FuelConsumption,
  InventoryStats,
  BulkUpsertResult,
  ImportError,
  VinDecodingResult,
} from "./domain/types";

// Validator types for consumers (e.g. Börsen-Hub building bulk upsert payloads)
export type {
  CreateVehicleInput,
  UpdateVehicleInput,
  UpdateVehicleStatusInput,
  BulkUpsertVehiclesInput,
  BulkUpsertVehicleItem,
} from "./domain/validators";

// AI tools (aggregated by server/trpc/ai-tools.ts when assistant module is built)
export { inventoryTools } from "./ai-tools";
