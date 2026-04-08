// ---------------------------------------------------------------------------
// Contact type values
// ---------------------------------------------------------------------------

export const CONTACT_TYPE_VALUES = [
  "customer",
  "prospect",
  "seller",
  "partner",
  "other",
] as const;

export const CONTACT_SOURCE_VALUES = [
  "manual",
  "csv_import",
  "whatsapp",
  "mobile_de",
  "autoscout24",
  "website",
  "phone",
  "walk_in",
  "referral",
  "meta_ads",
] as const;

export const INTEREST_TYPE_VALUES = [
  "inquiry",
  "test_drive",
  "offer_requested",
  "general",
] as const;

export const ACTIVITY_TYPE_VALUES = [
  "note",
  "call",
  "email_in",
  "email_out",
  "whatsapp_in",
  "whatsapp_out",
  "visit",
  "test_drive",
  "offer_sent",
  "deal_created",
  "deal_won",
  "deal_lost",
  "vehicle_interest",
  "type_change",
  "assignment_change",
] as const;

export const PREFERRED_CHANNEL_VALUES = [
  "whatsapp",
  "email",
  "phone",
  "sms",
] as const;

export const SALUTATION_VALUES = [
  "Herr",
  "Frau",
  "Divers",
  "Firma",
] as const;

export const GDPR_CONSENT_SOURCE_VALUES = [
  "form",
  "verbal",
  "import",
  "website",
] as const;

// ---------------------------------------------------------------------------
// UI labels (German — Händler-Vokabular)
// ---------------------------------------------------------------------------

export const CONTACT_TYPE_LABELS: Record<
  (typeof CONTACT_TYPE_VALUES)[number],
  string
> = {
  customer: "Kunde",
  prospect: "Interessent",
  seller: "Verkäufer",
  partner: "Partner",
  other: "Sonstig",
};

export const CONTACT_SOURCE_LABELS: Record<
  (typeof CONTACT_SOURCE_VALUES)[number],
  string
> = {
  manual: "Manuell",
  csv_import: "CSV-Import",
  whatsapp: "WhatsApp",
  mobile_de: "mobile.de",
  autoscout24: "AutoScout24",
  website: "Website",
  phone: "Telefon",
  walk_in: "Laufkunde",
  referral: "Empfehlung",
  meta_ads: "Meta Ads",
};

export const ACTIVITY_TYPE_LABELS: Record<
  (typeof ACTIVITY_TYPE_VALUES)[number],
  string
> = {
  note: "Notiz",
  call: "Anruf",
  email_in: "E-Mail erhalten",
  email_out: "E-Mail gesendet",
  whatsapp_in: "WhatsApp erhalten",
  whatsapp_out: "WhatsApp gesendet",
  visit: "Besuch",
  test_drive: "Probefahrt",
  offer_sent: "Angebot gesendet",
  deal_created: "Verkauf angelegt",
  deal_won: "Verkauf abgeschlossen",
  deal_lost: "Verkauf verloren",
  vehicle_interest: "Fahrzeug-Interesse",
  type_change: "Typ geändert",
  assignment_change: "Zuständigkeit geändert",
};

export const INTEREST_TYPE_LABELS: Record<
  (typeof INTEREST_TYPE_VALUES)[number],
  string
> = {
  inquiry: "Anfrage",
  test_drive: "Probefahrt",
  offer_requested: "Angebot angefragt",
  general: "Allgemein",
};

// ---------------------------------------------------------------------------
// Roles with full access (ContactView incl. notes, GDPR)
// ---------------------------------------------------------------------------

export const FULL_ACCESS_ROLES = ["owner", "admin", "manager"] as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

// ---------------------------------------------------------------------------
// Inactivity threshold (days) — computed at query time
// ---------------------------------------------------------------------------

export const INACTIVITY_THRESHOLD_DAYS = 30;

// ---------------------------------------------------------------------------
// Import limits
// ---------------------------------------------------------------------------

export const MAX_IMPORT_CONTACTS = 500;
