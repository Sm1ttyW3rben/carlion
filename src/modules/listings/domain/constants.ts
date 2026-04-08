export const PLATFORM_VALUES = ["mobile_de", "autoscout24"] as const;

export const CONNECTION_STATUS_VALUES = [
  "disconnected",
  "connected",
  "draining",
  "error",
] as const;

export const SYNC_STATUS_VALUES = [
  "pending",
  "synced",
  "error",
  "deactivated",
] as const;

export const IMPORT_SESSION_STATUS_VALUES = [
  "pending",
  "confirmed",
  "expired",
] as const;

// ---------------------------------------------------------------------------
// Labels (German — Händler-Vokabular)
// ---------------------------------------------------------------------------

export const PLATFORM_LABELS: Record<(typeof PLATFORM_VALUES)[number], string> = {
  mobile_de: "mobile.de",
  autoscout24: "AutoScout24",
};

export const SYNC_STATUS_LABELS: Record<(typeof SYNC_STATUS_VALUES)[number], string> = {
  pending: "Ausstehend",
  synced: "Inseriert",
  error: "Fehler",
  deactivated: "Deaktiviert",
};

export const CONNECTION_STATUS_LABELS: Record<
  (typeof CONNECTION_STATUS_VALUES)[number],
  string
> = {
  disconnected: "Nicht verbunden",
  connected: "Verbunden",
  draining: "Wird getrennt…",
  error: "Verbindungsfehler",
};

// ---------------------------------------------------------------------------
// Business rules
// ---------------------------------------------------------------------------

/** Vehicle statuses that trigger automatic listing deactivation via reconcile cron */
export const AUTO_DEACTIVATE_STATUSES = ["sold", "delivered"] as const;

/** Import session TTL in milliseconds (1 hour) */
export const IMPORT_SESSION_TTL_MS = 60 * 60 * 1000;

/** Drain timeout: after this many hours, force disconnect even if listings remain active */
export const DRAIN_TIMEOUT_HOURS = 24;

/** Pagination */
export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

/** Outbox service name for börsen sync */
export const OUTBOX_SERVICE = "boersen_sync" as const;

/** Reconcile: only update listing if vehicle was updated after this many seconds ago */
export const RECONCILE_MIN_AGE_SECONDS = 30;
