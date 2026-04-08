/**
 * Website Builder — Domain Constants
 * Spec: MOD_11 Section 11
 */

export const DEFAULT_HERO_CTA_TEXT = "Bestand ansehen";
export const DEFAULT_HERO_HEADLINE = "Ihr Gebrauchtwagen-Spezialist";

/** Rate limiting: max submissions per IP per window */
export const RATE_LIMIT_SUBMISSIONS = 5;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** ISR revalidation intervals */
export const ISR_VEHICLES_SECONDS = 60;
export const ISR_SETTINGS_SECONDS = 300;

/** Default list limit for submissions */
export const DEFAULT_SUBMISSIONS_LIMIT = 20;
export const MAX_SUBMISSIONS_LIMIT = 100;

/** Outbox service key for email notifications */
export const OUTBOX_SERVICE_EMAIL = "resend";
