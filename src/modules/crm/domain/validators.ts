import { z } from "zod";
import {
  CONTACT_TYPE_VALUES,
  CONTACT_SOURCE_VALUES,
  INTEREST_TYPE_VALUES,
  ACTIVITY_TYPE_VALUES,
  PREFERRED_CHANNEL_VALUES,
  GDPR_CONSENT_SOURCE_VALUES,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_IMPORT_CONTACTS,
} from "./constants";

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const contactTypeSchema = z.enum(CONTACT_TYPE_VALUES);
export const contactSourceSchema = z.enum(CONTACT_SOURCE_VALUES);
export const interestTypeSchema = z.enum(INTEREST_TYPE_VALUES);
export const activityTypeSchema = z.enum(ACTIVITY_TYPE_VALUES);

// ---------------------------------------------------------------------------
// Create — crm.create
// Spec: MOD_01 Section 5 — crm.create
// ---------------------------------------------------------------------------

export const createContactSchema = z
  .object({
    salutation: z.string().max(20).optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    companyName: z.string().max(200).optional(),
    email: z.string().email().max(200).optional(),
    phone: z.string().max(30).optional(),
    phoneMobile: z.string().max(30).optional(),
    whatsappNumber: z.string().max(30).optional(),
    street: z.string().max(200).optional(),
    zipCode: z.string().max(10).optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(5).default("DE"),
    contactType: contactTypeSchema.default("prospect"),
    source: contactSourceSchema.default("manual"),
    tags: z.array(z.string().max(50)).default([]),
    preferredChannel: z.enum(PREFERRED_CHANNEL_VALUES).optional(),
    notes: z.string().max(10000).optional(),
    gdprConsentAt: z.string().datetime().optional(),
    gdprConsentSource: z.enum(GDPR_CONSENT_SOURCE_VALUES).optional(),
    marketingConsent: z.boolean().default(false),
  })
  .refine((data) => data.lastName || data.companyName, {
    message: "Nachname oder Firmenname muss angegeben werden.",
    path: ["lastName"],
  });

export type CreateContactInput = z.infer<typeof createContactSchema>;

// ---------------------------------------------------------------------------
// Update — crm.update
// EXCLUDED: assigned_to (only via crm.assignContact),
//           source, created_by, created_at, deleted_at
// ---------------------------------------------------------------------------

export const updateContactSchema = z
  .object({
    id: z.string().uuid(),
    salutation: z.string().max(20).nullable().optional(),
    firstName: z.string().max(100).nullable().optional(),
    lastName: z.string().max(100).nullable().optional(),
    companyName: z.string().max(200).nullable().optional(),
    email: z.string().email().max(200).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    phoneMobile: z.string().max(30).nullable().optional(),
    whatsappNumber: z.string().max(30).nullable().optional(),
    street: z.string().max(200).nullable().optional(),
    zipCode: z.string().max(10).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    country: z.string().max(5).optional(),
    contactType: contactTypeSchema.optional(),
    tags: z.array(z.string().max(50)).optional(),
    preferredChannel: z.enum(PREFERRED_CHANNEL_VALUES).nullable().optional(),
    language: z.string().max(5).optional(),
    notes: z.string().max(10000).nullable().optional(),
    gdprConsentAt: z.string().datetime().nullable().optional(),
    gdprConsentSource: z.enum(GDPR_CONSENT_SOURCE_VALUES).nullable().optional(),
    marketingConsent: z.boolean().optional(),
  });

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ---------------------------------------------------------------------------
// List — crm.list
// ---------------------------------------------------------------------------

export const contactListInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  search: z.string().max(200).optional(),
  contactType: z.union([contactTypeSchema, z.array(contactTypeSchema)]).optional(),
  source: z.union([contactSourceSchema, z.array(contactSourceSchema)]).optional(),
  tags: z.array(z.string().max(50)).optional(),
  assignedTo: z.string().uuid().optional(),
  isInactive: z.boolean().optional(),
  vehicleId: z.string().uuid().optional(),
  sortBy: z.enum(["created_at", "last_name", "last_interaction_at"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ContactListInput = z.infer<typeof contactListInputSchema>;

// ---------------------------------------------------------------------------
// Add activity — crm.addActivity
// ---------------------------------------------------------------------------

export const createActivitySchema = z.object({
  contactId: z.string().uuid(),
  activityType: activityTypeSchema,
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  vehicleId: z.string().uuid().optional(),
  performedAt: z.string().datetime().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

// ---------------------------------------------------------------------------
// Get activities — crm.getActivities
// ---------------------------------------------------------------------------

export const getActivitiesSchema = z.object({
  contactId: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

export type GetActivitiesInput = z.infer<typeof getActivitiesSchema>;

// ---------------------------------------------------------------------------
// Add vehicle interest — crm.addVehicleInterest
// ---------------------------------------------------------------------------

export const addVehicleInterestSchema = z.object({
  contactId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  interestType: interestTypeSchema.default("inquiry"),
  notes: z.string().max(2000).optional(),
});

export type AddVehicleInterestInput = z.infer<typeof addVehicleInterestSchema>;

// ---------------------------------------------------------------------------
// Remove vehicle interest — crm.removeVehicleInterest
// ---------------------------------------------------------------------------

export const removeVehicleInterestSchema = z.object({
  contactId: z.string().uuid(),
  vehicleId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Assign contact — crm.assignContact
// ---------------------------------------------------------------------------

export const assignContactSchema = z.object({
  contactId: z.string().uuid(),
  assignToUserId: z.string().uuid().nullable(),
});

export type AssignContactInput = z.infer<typeof assignContactSchema>;

// ---------------------------------------------------------------------------
// Import contacts — crm.importContacts
// ---------------------------------------------------------------------------

export const importContactsSchema = z.object({
  contacts: z
    .array(
      createContactSchema.innerType() // unwrap refine for individual items — validated in service
    )
    .min(1)
    .max(MAX_IMPORT_CONTACTS),
  skipDuplicates: z.boolean().default(true),
});

export type ImportContactsInput = z.infer<typeof importContactsSchema>;
