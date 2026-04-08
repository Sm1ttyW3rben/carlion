/**
 * Website Builder — Domain Types
 * Spec: MOD_11 Section 4 & 6
 */

// ---------------------------------------------------------------------------
// View types (API responses)
// ---------------------------------------------------------------------------

export interface WebsiteSettingsView {
  id: string;
  isPublished: boolean;
  publishedAt: string | null;

  heroHeadline: string | null;
  heroSubheadline: string | null;
  heroCtatext: string | null;
  aboutText: string | null;

  contactFormEnabled: boolean;
  contactFormRecipients: string[];

  metaTitle: string | null;
  metaDescription: string | null;
  googleAnalyticsId: string | null;

  updatedAt: string | null;
}

export interface SubmissionView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  vehicle: { id: string; make: string; model: string } | null;
  processed: boolean;
  contactId: string | null;
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// Public types (for public delivery routes)
// ---------------------------------------------------------------------------

export interface PublicWebsiteSettings {
  isPublished: boolean;
  heroHeadline: string | null;
  heroSubheadline: string | null;
  heroCtatext: string | null;
  aboutText: string | null;
  contactFormEnabled: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  googleAnalyticsId: string | null;
}

// ---------------------------------------------------------------------------
// Publish-gate result
// ---------------------------------------------------------------------------

export interface PublishGateResult {
  canPublish: boolean;
  checks: {
    brandingComplete: boolean;
    hasPublishedVehicle: boolean;
  };
}
