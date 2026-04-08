/**
 * Sales tRPC Router — thin orchestration layer.
 * Business logic lives in sales-service.ts.
 * Spec: MOD_03 Section 6
 */

import { z } from "zod";
import { createTRPCRouter, roleProcedure, managerProcedure } from "@/server/trpc/trpc";
import * as salesService from "../services/sales-service";
import {
  dealListInputSchema,
  createDealSchema,
  updateDealSchema,
  moveToStageSchema,
  assignDealSchema,
  pipelineBoardInputSchema,
  salesStatsInputSchema,
} from "../domain/validators";

const salesProcedure = roleProcedure(["owner", "admin", "manager", "salesperson"]);

export const salesRouter = createTRPCRouter({

  list: salesProcedure
    .input(dealListInputSchema)
    .query(({ input, ctx }) => salesService.list(input, ctx)),

  getById: salesProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input, ctx }) => salesService.getById(input.id, ctx)),

  create: salesProcedure
    .input(createDealSchema)
    .mutation(({ input, ctx }) => salesService.create(input, ctx)),

  update: salesProcedure
    .input(updateDealSchema)
    .mutation(({ input, ctx }) => salesService.update(input, ctx)),

  moveToStage: salesProcedure
    .input(moveToStageSchema)
    .mutation(({ input, ctx }) => salesService.moveToStage(input, ctx)),

  assignDeal: managerProcedure
    .input(assignDealSchema)
    .mutation(({ input, ctx }) => salesService.assignDeal(input, ctx)),

  archive: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => salesService.archive(input.id, ctx)),

  restore: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => salesService.restore(input.id, ctx)),

  getStats: managerProcedure
    .input(salesStatsInputSchema)
    .query(({ input, ctx }) => salesService.getStats(input, ctx)),

  getPipelineBoard: salesProcedure
    .input(pipelineBoardInputSchema)
    .query(({ input, ctx }) => salesService.getPipelineBoard(input, ctx)),
});
