/**
 * Website Builder Module — Public Exports
 *
 * Other modules MUST only access website-builder data via these exports.
 * Never import directly from internal module files.
 *
 * Spec: MOD_11
 */

// Drizzle tables — for cross-module FK references only
export { websiteSettings, websiteContactSubmissions } from "./db/schema";

// Public API (used by public delivery routes — no auth)
export {
  getPublicSettings,
  saveContactSubmission,
} from "./services/website-service";

// Types needed by consumers
export type {
  WebsiteSettingsView,
  SubmissionView,
  PublicWebsiteSettings,
  PublishGateResult,
} from "./domain/types";

// AI tools
export { websiteTools } from "./ai-tools";
