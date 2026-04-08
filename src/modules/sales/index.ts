/**
 * Sales Module — Public Exports
 * Spec: MOD_03 Section 8
 */

export {
  createDealFromExternal,
  getOpenDealForVehicle,
  getDealsForContact,
  getOpenDealsCount,
} from "./services/sales-service";

export type {
  DealRecord,
  DealView,
  DealListItem,
  DealStage,
  DealPriority,
  DealSource,
  SalesStats,
  PipelineBoard,
  CreateDealFromExternalResult,
} from "./domain/types";

export type {
  CreateDealInput,
  UpdateDealInput,
  MoveToStageInput,
} from "./domain/validators";

export { salesTools } from "./ai-tools";
