import type { DealRecord } from "../db/schema";
import type {
  DEAL_STAGE_VALUES,
  DEAL_PRIORITY_VALUES,
  DEAL_SOURCE_VALUES,
} from "./constants";

// ---------------------------------------------------------------------------
// Re-export DB type
// ---------------------------------------------------------------------------

export type { DealRecord };

// ---------------------------------------------------------------------------
// Enum types
// ---------------------------------------------------------------------------

export type DealStage = (typeof DEAL_STAGE_VALUES)[number];
export type DealPriority = (typeof DEAL_PRIORITY_VALUES)[number];
export type DealSource = (typeof DEAL_SOURCE_VALUES)[number];

// ---------------------------------------------------------------------------
// StageHistoryEntry
// ---------------------------------------------------------------------------

export interface StageHistoryEntry {
  id: string;
  fromStage: string | null;
  toStage: string;
  changedBy: { id: string; name: string } | null;
  changedAt: string;
  durationInStageHours: number | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// DealView — full detail view
// ---------------------------------------------------------------------------

export interface DealView {
  id: string;
  contact: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
  };
  vehicle: {
    id: string;
    make: string;
    model: string;
    variant: string | null;
    askingPriceGross: string | null;
    mainPhotoUrl: string | null;
  };
  assignedToUser: { id: string; name: string } | null;
  stage: DealStage;
  stageChangedAt: string;
  daysInCurrentStage: number;
  offeredPrice: string | null;
  finalPrice: string | null;
  tradeInVehicle: string | null;
  tradeInValue: string | null;
  financingRequested: boolean;
  financingNotes: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  internalNotes: string | null;
  priority: DealPriority;
  source: DealSource;
  stageHistory: StageHistoryEntry[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// DealViewRestricted — without deal conditions for salesperson and below
// ---------------------------------------------------------------------------

export type DealViewRestricted = Omit<
  DealView,
  "offeredPrice" | "finalPrice" | "tradeInValue" | "internalNotes" | "financingNotes"
>;

// ---------------------------------------------------------------------------
// DealListItem — compact view for list/board
// ---------------------------------------------------------------------------

export interface DealListItem {
  id: string;
  contactName: string;
  contactPhone: string | null;
  vehicleTitle: string;
  vehicleMainPhotoUrl: string | null;
  askingPrice: string | null;
  offeredPrice: string | null;
  stage: DealStage;
  daysInCurrentStage: number;
  priority: DealPriority;
  assignedToUser: { id: string; name: string } | null;
  financingRequested: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SalesStats — dashboard KPIs
// ---------------------------------------------------------------------------

export interface SalesStats {
  totalDeals: number;
  byStage: Record<DealStage, number>;
  openDeals: number;
  wonThisPeriod: number;
  lostThisPeriod: number;
  conversionRate: number;
  avgDaysToClose: number;
  totalRevenueThisPeriod: number;
  avgDealValue: number;
  pipelineValue: number;
}

// ---------------------------------------------------------------------------
// PipelineBoard — Kanban view
// ---------------------------------------------------------------------------

export interface PipelineBoardStage {
  stage: DealStage;
  label: string;
  deals: DealListItem[];
  totalCount: number;
  totalValue: number;
}

export interface PipelineBoard {
  stages: PipelineBoardStage[];
}

// ---------------------------------------------------------------------------
// CreateDealFromExternalResult — for cross-module use
// ---------------------------------------------------------------------------

export interface CreateDealFromExternalResult {
  deal: DealRecord | null;
  created: boolean;
  existingDealDifferentContact: boolean;
}
