/**
 * Inventory tRPC Router — thin orchestration layer.
 * Business logic lives in inventory-service.ts.
 * Spec: MOD_02 Section 5
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  roleProcedure,
  managerProcedure,
} from "@/server/trpc/trpc";
import * as inventoryService from "../services/inventory-service";
import {
  vehicleListInputSchema,
  createVehicleSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema,
  generateDescriptionSchema,
  decodeVinSchema,
  reorderPhotosSchema,
  deletePhotoSchema,
} from "../domain/validators";

// Roles that can create/edit vehicles
const editorProcedure = roleProcedure(["owner", "admin", "manager", "salesperson"]);

export const inventoryRouter = createTRPCRouter({

  /**
   * List vehicles with filters, search and cursor-based pagination.
   * Spec: MOD_02 Section 5 — inventory.list
   */
  list: protectedProcedure
    .input(vehicleListInputSchema)
    .query(({ input, ctx }) => inventoryService.list(input, ctx)),

  /**
   * Fetch a single vehicle with all details and resolved photo URLs.
   * Returns VehicleView (with prices) or VehicleViewRestricted (without) based on role.
   * Spec: MOD_02 Section 5 — inventory.getById
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input, ctx }) => inventoryService.getById(input.id, ctx)),

  /**
   * Create a new vehicle. Status is always 'draft', published is always false.
   * Triggers DAT VIN decode if VIN provided.
   * Spec: MOD_02 Section 5 — inventory.create
   */
  create: editorProcedure
    .input(createVehicleSchema)
    .mutation(({ input, ctx }) => inventoryService.create(input, ctx)),

  /**
   * Update vehicle master/price/description data.
   * EXCLUDES: status, published — use dedicated mutations for those.
   * Spec: MOD_02 Section 5 — inventory.update
   */
  update: editorProcedure
    .input(updateVehicleSchema)
    .mutation(({ input, ctx }) => inventoryService.update(input, ctx)),

  /**
   * Change vehicle status. Validates transitions and applies lifecycle side-effects.
   * Spec: MOD_02 Section 5 — inventory.updateStatus
   */
  updateStatus: editorProcedure
    .input(updateVehicleStatusSchema)
    .mutation(({ input, ctx }) => inventoryService.updateStatus(input, ctx)),

  /**
   * Publish a vehicle. Validates publish rules (status, price, photos).
   * Spec: MOD_02 Section 5 — inventory.publish
   */
  publish: editorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => inventoryService.publish(input.id, ctx)),

  /**
   * Depublish a vehicle. Cleans up public derivatives and triggers ISR.
   * Spec: MOD_02 Section 5 — inventory.unpublish
   */
  unpublish: editorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => inventoryService.unpublish(input.id, ctx)),

  /**
   * Archive a vehicle (soft delete). Sets status to archived.
   * owner/admin/manager only.
   * Spec: MOD_02 Section 5 — inventory.archive
   */
  archive: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => inventoryService.archive(input.id, ctx)),

  /**
   * Restore an archived vehicle. Sets status back to draft.
   * owner/admin/manager only.
   * Spec: MOD_02 Section 5 — inventory.restore
   */
  restore: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => inventoryService.restore(input.id, ctx)),

  /**
   * Inventory KPI stats for dashboard.
   * Spec: MOD_02 Section 5 — inventory.getStats
   */
  getStats: protectedProcedure
    .query(({ ctx }) => inventoryService.getStats(ctx)),

  /**
   * Generate AI-powered vehicle title + description.
   * Returns suggestion — does NOT save. Frontend shows preview, user saves via update.
   * Spec: MOD_02 Section 5 — inventory.generateDescription
   */
  generateDescription: editorProcedure
    .input(generateDescriptionSchema)
    .mutation(({ input, ctx }) =>
      inventoryService.generateDescription(input.vehicleId, ctx)
    ),

  /**
   * Decode VIN via DAT API. Returns null if DAT unavailable.
   * Spec: MOD_02 Section 5 — inventory.decodeVin
   */
  decodeVin: protectedProcedure
    .input(decodeVinSchema)
    .mutation(({ input }) => inventoryService.decodeVin(input.vin)),

  /**
   * Reorder vehicle photos.
   * Spec: MOD_02 Section 5 — inventory.reorderPhotos
   */
  reorderPhotos: editorProcedure
    .input(reorderPhotosSchema)
    .mutation(({ input, ctx }) =>
      inventoryService.reorderPhotos(input.vehicleId, input.photoIds, ctx)
    ),

  /**
   * Soft-delete a vehicle photo.
   * Spec: MOD_02 Section 5 — inventory.deletePhoto
   */
  deletePhoto: editorProcedure
    .input(deletePhotoSchema)
    .mutation(({ input, ctx }) =>
      inventoryService.deletePhoto(input.vehicleId, input.photoId, ctx)
    ),
});
