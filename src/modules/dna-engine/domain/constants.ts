// ---------------------------------------------------------------------------
// DNA-Engine — Constants & Enum Value Arrays
// Single source of truth for allowed enum values used by Zod schemas,
// DB enums, and UI components.
// ---------------------------------------------------------------------------

export const FONT_HEADING_VALUES = [
  "Inter",
  "Nunito",
  "Playfair Display",
  "Poppins",
] as const;

export const FONT_BODY_VALUES = [
  "Inter",
  "Open Sans",
  "Lato",
  "Nunito Sans",
] as const;

export const TONE_VALUES = [
  "professional",
  "friendly",
  "premium",
  "casual",
] as const;

export const FORMALITY_VALUES = ["du", "sie"] as const;

export const DEALERSHIP_TYPE_VALUES = [
  "einzelhaendler",
  "autohaus",
  "mehrmarkenhaendler",
  "premiumhaendler",
] as const;

export const DESCRIPTION_STYLE_VALUES = [
  "factual",
  "emotional",
  "balanced",
] as const;

export const BORDER_RADIUS_VALUES = [
  "none",
  "sm",
  "md",
  "lg",
  "full",
] as const;

export const BUTTON_STYLE_VALUES = ["solid", "outline", "ghost"] as const;

export const COMPLETENESS_VALUES = [
  "draft",
  "branding_complete",
  "publish_ready",
] as const;

export const REGENERATABLE_TEXT_FIELDS = [
  "welcome_message",
  "email_signature",
  "tagline",
] as const;

// ---------------------------------------------------------------------------
// Font pairings: tone → { heading, body }
// Heading and body fonts that work together per tonality.
// ---------------------------------------------------------------------------

export const FONT_PAIRINGS: Record<
  (typeof TONE_VALUES)[number],
  {
    heading: (typeof FONT_HEADING_VALUES)[number];
    body: (typeof FONT_BODY_VALUES)[number];
  }
> = {
  professional: { heading: "Inter", body: "Inter" },
  friendly: { heading: "Nunito", body: "Open Sans" },
  premium: { heading: "Playfair Display", body: "Lato" },
  casual: { heading: "Poppins", body: "Nunito Sans" },
};

// ---------------------------------------------------------------------------
// Completeness model — which fields are required at each level
// ---------------------------------------------------------------------------

export const COMPLETENESS_FIELDS = {
  branding_complete: [
    "primaryColor",
    "tone",
    "formality",
    "address",
    "phone",
    "email",
  ] as const,
  publish_ready: [
    "primaryColor",
    "tone",
    "formality",
    "address",
    "phone",
    "email",
    "openingHours",
    "imprintData",
    "logoFileId",
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// Branding defaults (mirrors DB defaults)
// ---------------------------------------------------------------------------

export const BRANDING_DEFAULTS = {
  primaryColor: "#2563EB",
  secondaryColor: "#1E40AF",
  backgroundColor: "#FFFFFF",
  textColor: "#1A1A1A",
  fontHeading: "Inter" as const,
  fontBody: "Inter" as const,
  tone: "professional" as const,
  formality: "sie" as const,
  dealershipType: "einzelhaendler" as const,
  descriptionStyle: "balanced" as const,
  borderRadius: "md" as const,
  buttonStyle: "solid" as const,
  completeness: "draft" as const,
};

// ---------------------------------------------------------------------------
// Border radius values in rem (for CSS generation)
// ---------------------------------------------------------------------------

export const BORDER_RADIUS_REM: Record<
  (typeof BORDER_RADIUS_VALUES)[number],
  string
> = {
  none: "0",
  sm: "0.125rem",
  md: "0.375rem",
  lg: "0.5rem",
  full: "9999px",
};
