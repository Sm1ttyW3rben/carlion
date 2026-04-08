import type { ContactRecord } from "../db/schema";
import type {
  CONTACT_TYPE_VALUES,
  CONTACT_SOURCE_VALUES,
  INTEREST_TYPE_VALUES,
  ACTIVITY_TYPE_VALUES,
} from "./constants";

// ---------------------------------------------------------------------------
// Re-export DB type
// ---------------------------------------------------------------------------

export type { ContactRecord };

// ---------------------------------------------------------------------------
// Enum types
// ---------------------------------------------------------------------------

export type ContactType = (typeof CONTACT_TYPE_VALUES)[number];
export type ContactSource = (typeof CONTACT_SOURCE_VALUES)[number];
export type InterestType = (typeof INTEREST_TYPE_VALUES)[number];
export type ActivityType = (typeof ACTIVITY_TYPE_VALUES)[number];

// ---------------------------------------------------------------------------
// VehicleInterestView — resolved interest for detail screen
// ---------------------------------------------------------------------------

export interface VehicleInterestView {
  id: string;
  vehicleId: string;
  vehicleLabel: string; // e.g. "BMW 320d" — resolved from vehicles
  interestType: InterestType;
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// ActivityView — single timeline entry
// ---------------------------------------------------------------------------

export interface ActivityView {
  id: string;
  activityType: ActivityType;
  title: string | null;
  description: string | null;
  vehicleId: string | null;
  vehicleLabel: string | null;
  dealId: string | null;
  messageId: string | null;
  performedBy: { id: string; name: string } | null;
  performedAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// ContactView — full view for roles with full access (owner, admin, manager)
// ---------------------------------------------------------------------------

export interface ContactView {
  id: string;
  displayName: string; // computed
  salutation: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  phoneMobile: string | null;
  whatsappNumber: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  country: string;
  contactType: ContactType;
  source: ContactSource;
  tags: string[];
  assignedToUser: { id: string; name: string } | null;
  preferredChannel: string | null;
  language: string;
  notes: string | null;
  gdprConsentAt: string | null;
  gdprConsentSource: string | null;
  marketingConsent: boolean;
  vehicleInterests: VehicleInterestView[];
  recentActivities: ActivityView[]; // last 5
  isInactive: boolean; // computed from last_interaction_at
  lastInteractionAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// ContactViewRestricted — without notes, GDPR consent fields
// for salesperson, receptionist
// ---------------------------------------------------------------------------

export type ContactViewRestricted = Omit<
  ContactView,
  "notes" | "gdprConsentAt" | "gdprConsentSource"
>;

// ---------------------------------------------------------------------------
// ContactListItem — compact view for list/grid
// ---------------------------------------------------------------------------

export interface ContactListItem {
  id: string;
  displayName: string;
  contactType: ContactType;
  email: string | null;
  phone: string | null;
  assignedToUser: { id: string; name: string } | null;
  tags: string[];
  isInactive: boolean;
  lastInteractionAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// CrmStats — dashboard KPIs
// ---------------------------------------------------------------------------

export interface CrmStats {
  totalContacts: number;
  byType: Record<ContactType, number>;
  bySource: Record<ContactSource, number>;
  newThisMonth: number;
  unassigned: number;
  inactiveCount: number;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportError {
  index: number;
  message: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: ImportError[];
}
