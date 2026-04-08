/**
 * CRM Module — Public Exports
 *
 * Other modules MUST only access CRM data via these exports.
 * Never import directly from internal module files.
 *
 * Spec: MOD_01 Section 7
 */

// Drizzle table — for cross-module FK references and JOIN queries only
export { contacts } from "./db/schema";

// Service functions for inter-module consumption
export {
  getContactById,
  findContactByPhone,
  findContactByPhoneMobile,
  findContactByEmail,
  findContactByWhatsApp,
  createContactFromExternal,
  addActivityForContact,
  markContactAsCustomer,
} from "./services/crm-service";

// Types needed by consumers
export type {
  ContactRecord,
  ContactView,
  ContactViewRestricted,
  ContactListItem,
  ContactType,
  ContactSource,
  ActivityType,
  InterestType,
  VehicleInterestView,
  ActivityView,
  CrmStats,
  ImportResult,
  ImportError,
} from "./domain/types";

// Validator types for consumers
export type {
  CreateContactInput,
  UpdateContactInput,
} from "./domain/validators";

// AI tools (aggregated by server/trpc/ai-tools.ts when assistant module is built)
export { crmTools } from "./ai-tools";
