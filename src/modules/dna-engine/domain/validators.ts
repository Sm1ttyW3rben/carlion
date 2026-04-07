import { z } from "zod";
import {
  FONT_HEADING_VALUES,
  FONT_BODY_VALUES,
  TONE_VALUES,
  FORMALITY_VALUES,
  DEALERSHIP_TYPE_VALUES,
  DESCRIPTION_STYLE_VALUES,
  BORDER_RADIUS_VALUES,
  BUTTON_STYLE_VALUES,
  REGENERATABLE_TEXT_FIELDS,
} from "./constants";

// ---------------------------------------------------------------------------
// Primitive schemas (reused across multiple inputs)
// ---------------------------------------------------------------------------

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Muss eine gültige Hex-Farbe sein (z.B. #2563EB)");

export const fontHeadingSchema = z.enum(FONT_HEADING_VALUES);
export const fontBodySchema = z.enum(FONT_BODY_VALUES);
export const toneSchema = z.enum(TONE_VALUES);
export const formalitySchema = z.enum(FORMALITY_VALUES);
export const dealershipTypeSchema = z.enum(DEALERSHIP_TYPE_VALUES);
export const descriptionStyleSchema = z.enum(DESCRIPTION_STYLE_VALUES);
export const borderRadiusSchema = z.enum(BORDER_RADIUS_VALUES);
export const buttonStyleSchema = z.enum(BUTTON_STYLE_VALUES);

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

export const addressSchema = z.object({
  street: z.string().min(1, "Straße ist erforderlich"),
  zip: z.string().min(1, "PLZ ist erforderlich"),
  city: z.string().min(1, "Ort ist erforderlich"),
  country: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Opening Hours
// ---------------------------------------------------------------------------

export const dayHoursSchema = z
  .object({
    open: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
    close: z.string().regex(/^\d{2}:\d{2}$/, "Format: HH:MM"),
    closed: z.boolean(),
  })
  .nullable();

export const openingHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

// ---------------------------------------------------------------------------
// Imprint Data
// ---------------------------------------------------------------------------

export const imprintDataSchema = z.object({
  managing_director: z.string().min(1, "Geschäftsführer ist erforderlich"),
  hrb: z.string().optional(),
  ust_id: z.string().optional(),
  court: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Update inputs — all fields optional (partial updates)
// ---------------------------------------------------------------------------

export const updateVisualIdentitySchema = z.object({
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.nullable().optional(),
  backgroundColor: hexColorSchema.optional(),
  textColor: hexColorSchema.optional(),
  fontHeading: fontHeadingSchema.optional(),
  fontBody: fontBodySchema.optional(),
  borderRadius: borderRadiusSchema.optional(),
  buttonStyle: buttonStyleSchema.optional(),
});

export const updateCommunicationSchema = z.object({
  tone: toneSchema.optional(),
  formality: formalitySchema.optional(),
  dealershipType: dealershipTypeSchema.optional(),
  descriptionStyle: descriptionStyleSchema.optional(),
  tagline: z.string().max(100).nullable().optional(),
  welcomeMessage: z.string().max(1000).nullable().optional(),
  emailSignature: z.string().max(2000).nullable().optional(),
});

export const updateBusinessDataSchema = z.object({
  address: addressSchema.nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("Ungültige E-Mail-Adresse").nullable().optional(),
  openingHours: openingHoursSchema.nullable().optional(),
  googleMapsUrl: z.string().url().nullable().optional(),
  imprintData: imprintDataSchema.nullable().optional(),
});

// ---------------------------------------------------------------------------
// Crawl inputs
// ---------------------------------------------------------------------------

const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

export const startCrawlSchema = z.object({
  url: z
    .string()
    .url("Bitte eine gültige URL eingeben")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (BLOCKED_HOSTS.includes(host)) return false;
        // Block private IP ranges
        if (host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")) return false;
        // Block Carlion domains
        if (host.includes("carlion")) return false;
        return true;
      } catch {
        return false;
      }
    }, "Diese URL ist nicht erlaubt"),
});

export const applyCrawlResultSchema = z.object({
  crawlId: z.string().uuid("Ungültige Crawl-ID"),
  visualOverrides: updateVisualIdentitySchema.optional(),
  communicationOverrides: updateCommunicationSchema.optional(),
  businessOverrides: updateBusinessDataSchema.optional(),
});

// ---------------------------------------------------------------------------
// Regenerate texts
// ---------------------------------------------------------------------------

export const regenerateTextsSchema = z.object({
  fields: z
    .array(z.enum(REGENERATABLE_TEXT_FIELDS))
    .min(1, "Mindestens ein Feld angeben"),
});

// ---------------------------------------------------------------------------
// Exported types inferred from schemas
// ---------------------------------------------------------------------------

export type UpdateVisualIdentityInput = z.infer<typeof updateVisualIdentitySchema>;
export type UpdateCommunicationInput = z.infer<typeof updateCommunicationSchema>;
export type UpdateBusinessDataInput = z.infer<typeof updateBusinessDataSchema>;
export type StartCrawlInput = z.infer<typeof startCrawlSchema>;
export type ApplyCrawlResultInput = z.infer<typeof applyCrawlResultSchema>;
export type RegenerateTextsInput = z.infer<typeof regenerateTextsSchema>;
