/**
 * DNA-Engine — Public Module Exports
 *
 * Other modules MUST only access DNA-Engine data via these exports.
 * Never import directly from internal module files.
 *
 * Spec: MOD_34 Section 10
 */

// Service functions for inter-module consumption
export { getBrandingForTenant, getPublicBrandingForSlug } from "./services/dna-service";

// Types needed by consumers
export type {
  TenantBrandingRecord,
  TenantBrandingView,
  PublicBranding,
  ColorPalette,
  ColorShades,
  ToneEnum,
  FormalityEnum,
  DealershipTypeEnum,
  DescriptionStyleEnum,
  FontHeadingEnum,
  FontBodyEnum,
  BorderRadiusEnum,
  ButtonStyleEnum,
  CompletenessEnum,
  Address,
  OpeningHours,
  ImprintData,
} from "./domain/types";

// CSS generation utility (used by Website Builder)
export { generateTailwindCssVars, generateColorPalette } from "./domain/color-palette";

// AI tools (aggregated by server/trpc/ai-tools.ts when assistant module is built)
export { dnaTools } from "./ai-tools";
