import type { TenantBrandingRecord, DnaCrawlResultRecord } from "../db/schema";
import type {
  TONE_VALUES,
  FORMALITY_VALUES,
  DEALERSHIP_TYPE_VALUES,
  DESCRIPTION_STYLE_VALUES,
  FONT_HEADING_VALUES,
  FONT_BODY_VALUES,
  BORDER_RADIUS_VALUES,
  BUTTON_STYLE_VALUES,
  COMPLETENESS_VALUES,
  REGENERATABLE_TEXT_FIELDS,
} from "./constants";

// ---------------------------------------------------------------------------
// Re-export DB types
// ---------------------------------------------------------------------------

export type { TenantBrandingRecord, DnaCrawlResultRecord };

// ---------------------------------------------------------------------------
// Enum types (derived from constant arrays)
// ---------------------------------------------------------------------------

export type ToneEnum = (typeof TONE_VALUES)[number];
export type FormalityEnum = (typeof FORMALITY_VALUES)[number];
export type DealershipTypeEnum = (typeof DEALERSHIP_TYPE_VALUES)[number];
export type DescriptionStyleEnum = (typeof DESCRIPTION_STYLE_VALUES)[number];
export type FontHeadingEnum = (typeof FONT_HEADING_VALUES)[number];
export type FontBodyEnum = (typeof FONT_BODY_VALUES)[number];
export type BorderRadiusEnum = (typeof BORDER_RADIUS_VALUES)[number];
export type ButtonStyleEnum = (typeof BUTTON_STYLE_VALUES)[number];
export type CompletenessEnum = (typeof COMPLETENESS_VALUES)[number];
export type RegeneratableTextField =
  (typeof REGENERATABLE_TEXT_FIELDS)[number];

// ---------------------------------------------------------------------------
// Sub-types for jsonb fields
// ---------------------------------------------------------------------------

export interface Address {
  street: string;
  zip: string;
  city: string;
  country?: string;
}

export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface DayHours {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  closed: boolean;
}

export type OpeningHours = Record<WeekDay, DayHours | null>;

export interface ImprintData {
  managing_director: string;
  hrb?: string;
  ust_id?: string;
  court?: string;
}

// ---------------------------------------------------------------------------
// Color Palette — full 11-shade scale + contrast colors
// ---------------------------------------------------------------------------

export interface ColorShades {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface ColorPalette {
  primary: ColorShades;
  secondary: ColorShades;
  // Text color to use on top of primary/secondary (WCAG AA compliant)
  onPrimary: string;
  onSecondary: string;
}

// ---------------------------------------------------------------------------
// Extracted data from website crawl
// ---------------------------------------------------------------------------

export interface LogoCandidate {
  url: string;
  context: "header" | "nav" | "og_image" | "favicon" | "schema_org" | "other";
}

export interface ColorFound {
  hex: string;
  frequency: number;
  context: "background" | "text" | "border" | "custom_prop" | "other";
}

export interface ExtractedTexts {
  tagline?: string;
  about?: string;
  metaDescription?: string;
  h1?: string;
}

export interface ExtractedContact {
  phone?: string;
  email?: string;
  address?: Partial<Address>;
}

export interface ExtractedData {
  logoCandidates: LogoCandidate[];
  colorsFound: ColorFound[];
  texts: ExtractedTexts;
  contact: ExtractedContact;
  openingHours?: Partial<OpeningHours>;
}

// ---------------------------------------------------------------------------
// AI analysis result (from Claude analysis prompt)
// ---------------------------------------------------------------------------

export interface AiAnalysisResult {
  tone: ToneEnum;
  toneReasoning: string;
  formality: FormalityEnum;
  formalityReasoning: string;
  dealershipType: DealershipTypeEnum;
  secondaryColor: string;
  accentColor?: string;
  fontHeading: FontHeadingEnum;
  fontBody: FontBodyEnum;
  tagline?: string;
  welcomeMessage?: string;
  confidence: {
    tone: number;
    formality: number;
    type: number;
  };
}

// ---------------------------------------------------------------------------
// TenantBrandingView — API response type with resolved URLs and tenant name
// Never exposes File IDs — frontend always gets resolved public URLs.
// ---------------------------------------------------------------------------

export interface TenantBrandingView {
  id: string;
  tenantId: string;
  tenantName: string; // from tenants.name

  // Visual Identity
  logoUrl: string | null; // resolved from files/storage
  faviconUrl: string | null; // resolved from files/storage
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  backgroundColor: string;
  textColor: string;
  colorPalette: ColorPalette | Record<string, never>;
  fontHeading: FontHeadingEnum;
  fontBody: FontBodyEnum;
  borderRadius: BorderRadiusEnum;
  buttonStyle: ButtonStyleEnum;

  // Communication Identity
  tone: ToneEnum;
  formality: FormalityEnum;
  dealershipType: DealershipTypeEnum;
  tagline: string | null;
  welcomeMessage: string | null;
  emailSignature: string | null;
  descriptionStyle: DescriptionStyleEnum;

  // Business Data
  address: Address | null;
  phone: string | null;
  email: string | null;
  openingHours: OpeningHours | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  imprintData: ImprintData | null;

  // Completeness
  completeness: CompletenessEnum;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// PublicBranding — reduced DTO for public delivery route
// No internal IDs, no imprint_data, no meta fields, no completeness.
// ---------------------------------------------------------------------------

export interface PublicBranding {
  // From tenants
  name: string;
  slug: string;

  // From tenant_branding
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  backgroundColor: string;
  textColor: string;
  colorPalette: ColorPalette | Record<string, never>;
  fontHeading: FontHeadingEnum;
  fontBody: FontBodyEnum;
  borderRadius: BorderRadiusEnum;
  buttonStyle: ButtonStyleEnum;
  tone: ToneEnum;
  formality: FormalityEnum;
  tagline: string | null;

  // Resolved URLs
  logoUrl: string | null;
  faviconUrl: string | null;

  // Business data (if set)
  address: Address | null;
  phone: string | null;
  email: string | null; // Intentionally public — dealership contact info
  openingHours: OpeningHours | null;
  googleMapsUrl: string | null;
}

// ---------------------------------------------------------------------------
// DnaCrawlResult — view type returned by startCrawl mutation
// ---------------------------------------------------------------------------

export type DnaCrawlResult = DnaCrawlResultRecord;

// ---------------------------------------------------------------------------
// AI Tool types (used in ai-tools.ts; canonical type defined here temporarily
// until the AI assistant module establishes the shared AiTool interface)
// ---------------------------------------------------------------------------

export interface AiToolContext {
  userId: string;
  tenantId: string;
  role: string;
  db: unknown; // typed as unknown here to avoid circular imports
}

export interface AiTool<TParams = Record<string, unknown>> {
  name: string;
  description: string;
  type: "read" | "write";
  parameters: Record<string, unknown>;
  execute: (params: TParams, ctx: AiToolContext) => Promise<unknown>;
}
