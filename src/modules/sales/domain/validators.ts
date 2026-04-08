import { z } from "zod";
import {
  DEAL_STAGE_VALUES,
  DEAL_PRIORITY_VALUES,
  DEAL_SOURCE_VALUES,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  DEFAULT_BOARD_LIMIT_PER_STAGE,
  MAX_BOARD_LIMIT_PER_STAGE,
} from "./constants";

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const dealStageSchema = z.enum(DEAL_STAGE_VALUES);
export const dealPrioritySchema = z.enum(DEAL_PRIORITY_VALUES);
export const dealSourceSchema = z.enum(DEAL_SOURCE_VALUES);

// ---------------------------------------------------------------------------
// Create — sales.create
// ---------------------------------------------------------------------------

export const createDealSchema = z.object({
  contactId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  source: dealSourceSchema.default("manual"),
  offeredPrice: z.number().min(0).optional(),
  priority: dealPrioritySchema.default("normal"),
  internalNotes: z.string().max(5000).optional(),
  financingRequested: z.boolean().default(false),
  financingNotes: z.string().max(2000).optional(),
  tradeInVehicle: z.string().max(500).optional(),
  tradeInValue: z.number().min(0).optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;

// ---------------------------------------------------------------------------
// Update — sales.update
// EXCLUDED: stage, contact_id, vehicle_id, assigned_to, source,
//           final_price, won_at, lost_at, lost_reason
// ---------------------------------------------------------------------------

export const updateDealSchema = z.object({
  id: z.string().uuid(),
  offeredPrice: z.number().min(0).nullable().optional(),
  tradeInVehicle: z.string().max(500).nullable().optional(),
  tradeInValue: z.number().min(0).nullable().optional(),
  financingRequested: z.boolean().optional(),
  financingNotes: z.string().max(2000).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  priority: dealPrioritySchema.optional(),
});

export type UpdateDealInput = z.infer<typeof updateDealSchema>;

// ---------------------------------------------------------------------------
// Move to stage — sales.moveToStage
// ---------------------------------------------------------------------------

export const moveToStageSchema = z.object({
  id: z.string().uuid(),
  stage: dealStageSchema,
  notes: z.string().max(2000).optional(),
  lostReason: z.string().max(1000).optional(),
  finalPrice: z.number().min(0).optional(),
});

export type MoveToStageInput = z.infer<typeof moveToStageSchema>;

// ---------------------------------------------------------------------------
// Assign — sales.assignDeal
// ---------------------------------------------------------------------------

export const assignDealSchema = z.object({
  id: z.string().uuid(),
  assignToUserId: z.string().uuid().nullable(),
});

export type AssignDealInput = z.infer<typeof assignDealSchema>;

// ---------------------------------------------------------------------------
// List — sales.list
// ---------------------------------------------------------------------------

export const dealListInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  stage: z.union([dealStageSchema, z.array(dealStageSchema)]).optional(),
  assignedTo: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  priority: dealPrioritySchema.optional(),
  isOpen: z.boolean().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(["created_at", "stage_changed_at", "offered_price"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type DealListInput = z.infer<typeof dealListInputSchema>;

// ---------------------------------------------------------------------------
// Pipeline Board — sales.getPipelineBoard
// ---------------------------------------------------------------------------

export const pipelineBoardInputSchema = z.object({
  assignedTo: z.string().uuid().optional(),
  limitPerStage: z.number().int().min(1).max(MAX_BOARD_LIMIT_PER_STAGE).default(DEFAULT_BOARD_LIMIT_PER_STAGE),
});

export type PipelineBoardInput = z.infer<typeof pipelineBoardInputSchema>;

// ---------------------------------------------------------------------------
// Stats — sales.getStats
// ---------------------------------------------------------------------------

export const salesStatsInputSchema = z.object({
  period: z.enum(["month", "quarter", "year"]).default("month"),
});

export type SalesStatsInput = z.infer<typeof salesStatsInputSchema>;
