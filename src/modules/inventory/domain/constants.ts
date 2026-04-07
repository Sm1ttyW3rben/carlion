// ---------------------------------------------------------------------------
// Vehicle status values
// ---------------------------------------------------------------------------

export const VEHICLE_STATUS_VALUES = [
  "draft",
  "in_preparation",
  "available",
  "reserved",
  "sold",
  "delivered",
  "archived",
] as const;

export const VEHICLE_TAX_TYPE_VALUES = ["margin", "regular"] as const;

export const VEHICLE_SOURCE_VALUES = [
  "manual",
  "boersen_import",
  "trade_in",
  "purchase",
] as const;

// ---------------------------------------------------------------------------
// Statuses that allow publishing
// ---------------------------------------------------------------------------

export const PUBLISHABLE_STATUSES = ["available", "reserved"] as const;

// ---------------------------------------------------------------------------
// Allowed status transitions (from → [to...])
// Spec: MOD_02 Section 12.1
// ---------------------------------------------------------------------------

export const STATUS_TRANSITIONS: Record<
  (typeof VEHICLE_STATUS_VALUES)[number],
  readonly (typeof VEHICLE_STATUS_VALUES)[number][]
> = {
  draft:          ["in_preparation", "available", "archived"],
  in_preparation: ["draft", "available", "archived"],
  available:      ["in_preparation", "reserved", "sold", "archived"],
  reserved:       ["available", "sold", "archived"],
  sold:           ["delivered", "archived"],
  delivered:      ["archived"],
  archived:       ["draft"],
};

// ---------------------------------------------------------------------------
// UI labels (German — Händler-Vokabular)
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<
  (typeof VEHICLE_STATUS_VALUES)[number],
  string
> = {
  draft:          "Entwurf",
  in_preparation: "In Aufbereitung",
  available:      "Verfügbar",
  reserved:       "Reserviert",
  sold:           "Verkauft",
  delivered:      "Übergeben",
  archived:       "Archiviert",
};

// ---------------------------------------------------------------------------
// Roles that can see purchase prices and margins
// Spec: MOD_02 Section 12.6
// ---------------------------------------------------------------------------

export const PRICE_VISIBILITY_ROLES = ["owner", "admin", "manager"] as const;

// ---------------------------------------------------------------------------
// Standzeit thresholds for visual warnings
// ---------------------------------------------------------------------------

export const LANGSTEHER_THRESHOLD_DAYS = 90;
export const WARNING_THRESHOLD_DAYS = 60;

// ---------------------------------------------------------------------------
// Photo limits
// ---------------------------------------------------------------------------

export const MAX_PHOTOS_PER_VEHICLE = 30;
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;
