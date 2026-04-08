/**
 * CRM tRPC Router — thin orchestration layer.
 * Business logic lives in crm-service.ts.
 * Spec: MOD_01 Section 5
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  roleProcedure,
  managerProcedure,
  adminProcedure,
} from "@/server/trpc/trpc";
import * as crmService from "../services/crm-service";
import {
  contactListInputSchema,
  createContactSchema,
  updateContactSchema,
  createActivitySchema,
  getActivitiesSchema,
  addVehicleInterestSchema,
  removeVehicleInterestSchema,
  assignContactSchema,
  importContactsSchema,
} from "../domain/validators";

// Roles that can create/edit contacts
const editorProcedure = roleProcedure([
  "owner", "admin", "manager", "salesperson", "receptionist",
]);

// Roles that can manage vehicle interests
const salesProcedure = roleProcedure([
  "owner", "admin", "manager", "salesperson",
]);

export const crmRouter = createTRPCRouter({

  /**
   * List contacts with filters, search and cursor-based pagination.
   * Spec: MOD_01 Section 5 — crm.list
   */
  list: protectedProcedure
    .input(contactListInputSchema)
    .query(({ input, ctx }) => crmService.list(input, ctx)),

  /**
   * Fetch a single contact with all details, vehicle interests and recent activities.
   * Returns ContactView or ContactViewRestricted based on role.
   * viewer → FORBIDDEN.
   * Spec: MOD_01 Section 5 — crm.getById
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ input, ctx }) => crmService.getById(input.id, ctx)),

  /**
   * Create a new contact. Runs duplicate check on channels.
   * Spec: MOD_01 Section 5 — crm.create
   */
  create: editorProcedure
    .input(createContactSchema)
    .mutation(({ input, ctx }) => crmService.create(input, ctx)),

  /**
   * Update contact data. EXCLUDES: assigned_to, source, created_by.
   * Spec: MOD_01 Section 5 — crm.update
   */
  update: editorProcedure
    .input(updateContactSchema)
    .mutation(({ input, ctx }) => crmService.update(input, ctx)),

  /**
   * Archive a contact (soft delete).
   * owner/admin/manager only.
   * Spec: MOD_01 Section 5 — crm.archive
   */
  archive: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => crmService.archive(input.id, ctx)),

  /**
   * Restore an archived contact.
   * owner/admin/manager only.
   * Spec: MOD_01 Section 5 — crm.restore
   */
  restore: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input, ctx }) => crmService.restore(input.id, ctx)),

  /**
   * Add vehicle interest for a contact.
   * Spec: MOD_01 Section 5 — crm.addVehicleInterest
   */
  addVehicleInterest: salesProcedure
    .input(addVehicleInterestSchema)
    .mutation(({ input, ctx }) => crmService.addVehicleInterest(input, ctx)),

  /**
   * Remove vehicle interest.
   * Spec: MOD_01 Section 5 — crm.removeVehicleInterest
   */
  removeVehicleInterest: salesProcedure
    .input(removeVehicleInterestSchema)
    .mutation(({ input, ctx }) =>
      crmService.removeVehicleInterest(input.contactId, input.vehicleId, ctx)
    ),

  /**
   * Add an activity/note to a contact's timeline.
   * Spec: MOD_01 Section 5 — crm.addActivity
   */
  addActivity: editorProcedure
    .input(createActivitySchema)
    .mutation(({ input, ctx }) => crmService.addActivity(input, ctx)),

  /**
   * Get paginated activities for a contact.
   * Spec: MOD_01 Section 5 — crm.getActivities
   */
  getActivities: protectedProcedure
    .input(getActivitiesSchema)
    .query(({ input, ctx }) => crmService.getActivities(input, ctx)),

  /**
   * Assign or unassign a contact to a team member.
   * owner/admin/manager only.
   * Spec: MOD_01 Section 5 — crm.assignContact
   */
  assignContact: managerProcedure
    .input(assignContactSchema)
    .mutation(({ input, ctx }) => crmService.assignContact(input, ctx)),

  /**
   * Bulk import contacts from CSV/Excel.
   * owner/admin only.
   * Spec: MOD_01 Section 5 — crm.importContacts
   */
  importContacts: adminProcedure
    .input(importContactsSchema)
    .mutation(({ input, ctx }) => crmService.importContacts(input, ctx)),

  /**
   * CRM KPI stats for dashboard.
   * Spec: MOD_01 Section 5 — crm.getStats
   */
  getStats: protectedProcedure
    .query(({ ctx }) => crmService.getStats(ctx)),
});
