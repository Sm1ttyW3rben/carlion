// ---------------------------------------------------------------------------
// Deal pipeline stages (fixed in MVP)
// ---------------------------------------------------------------------------

export const DEAL_STAGE_VALUES = [
  "inquiry",
  "contacted",
  "viewing",
  "offer",
  "negotiation",
  "won",
  "lost",
] as const;

export const OPEN_STAGE_VALUES = [
  "inquiry",
  "contacted",
  "viewing",
  "offer",
  "negotiation",
] as const;

export const DEAL_PRIORITY_VALUES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export const DEAL_SOURCE_VALUES = [
  "manual",
  "whatsapp",
  "mobile_de",
  "autoscout24",
  "website",
  "phone",
  "walk_in",
] as const;

// ---------------------------------------------------------------------------
// Stage labels (German — Händler-Vokabular)
// ---------------------------------------------------------------------------

export const DEAL_STAGE_LABELS: Record<
  (typeof DEAL_STAGE_VALUES)[number],
  string
> = {
  inquiry: "Anfrage",
  contacted: "Kontaktiert",
  viewing: "Besichtigung",
  offer: "Angebot",
  negotiation: "Verhandlung",
  won: "Abschluss",
  lost: "Verloren",
};

export const DEAL_STAGE_ORDER: Record<
  (typeof DEAL_STAGE_VALUES)[number],
  number
> = {
  inquiry: 1,
  contacted: 2,
  viewing: 3,
  offer: 4,
  negotiation: 5,
  won: 99,
  lost: 99,
};

export const DEAL_PRIORITY_LABELS: Record<
  (typeof DEAL_PRIORITY_VALUES)[number],
  string
> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};

export const DEAL_PRIORITY_RANK: Record<
  (typeof DEAL_PRIORITY_VALUES)[number],
  number
> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};

export const DEAL_SOURCE_LABELS: Record<
  (typeof DEAL_SOURCE_VALUES)[number],
  string
> = {
  manual: "Manuell",
  whatsapp: "WhatsApp",
  mobile_de: "mobile.de",
  autoscout24: "AutoScout24",
  website: "Website",
  phone: "Telefon",
  walk_in: "Laufkunde",
};

// ---------------------------------------------------------------------------
// Stage transitions (from → [to...])
// Spec: MOD_03 Section 10.1
// ---------------------------------------------------------------------------

export const STAGE_TRANSITIONS: Record<
  (typeof DEAL_STAGE_VALUES)[number],
  readonly (typeof DEAL_STAGE_VALUES)[number][]
> = {
  inquiry:      ["contacted", "viewing", "offer", "lost"],
  contacted:    ["inquiry", "viewing", "offer", "lost"],
  viewing:      ["offer", "negotiation", "lost"],
  offer:        ["negotiation", "won", "lost"],
  negotiation:  ["offer", "won", "lost"],
  won:          [],           // terminal
  lost:         ["inquiry"],  // reopen only
};

// ---------------------------------------------------------------------------
// Vehicle statuses valid for deal creation
// ---------------------------------------------------------------------------

export const DEAL_ELIGIBLE_VEHICLE_STATUSES = ["available", "reserved"] as const;

// ---------------------------------------------------------------------------
// Roles that can see deal conditions (offered/final price, trade-in value, internal notes)
// Spec: MOD_03 Section 9 (role-based DTOs)
// ---------------------------------------------------------------------------

export const DEAL_CONDITION_VISIBILITY_ROLES = ["owner", "admin", "manager"] as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_BOARD_LIMIT_PER_STAGE = 20;
export const MAX_BOARD_LIMIT_PER_STAGE = 50;
