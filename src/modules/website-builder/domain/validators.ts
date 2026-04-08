import { z } from "zod";
import { MAX_SUBMISSIONS_LIMIT, DEFAULT_SUBMISSIONS_LIMIT } from "./constants";

// ---------------------------------------------------------------------------
// website.updateSettings
// ---------------------------------------------------------------------------

export const updateWebsiteSettingsSchema = z.object({
  heroHeadline: z.string().max(200).nullable().optional(),
  heroSubheadline: z.string().max(300).nullable().optional(),
  heroCtatext: z.string().max(60).nullable().optional(),
  aboutText: z.string().max(5000).nullable().optional(),
  contactFormEnabled: z.boolean().optional(),
  contactFormRecipients: z.array(z.string().email()).max(5).optional(),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  googleAnalyticsId: z.string().max(30).nullable().optional(),
});

export type UpdateWebsiteSettingsInput = z.infer<typeof updateWebsiteSettingsSchema>;

// ---------------------------------------------------------------------------
// website.listSubmissions
// ---------------------------------------------------------------------------

export const listSubmissionsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(MAX_SUBMISSIONS_LIMIT).default(DEFAULT_SUBMISSIONS_LIMIT),
  processed: z.boolean().optional(),
});

export type ListSubmissionsInput = z.infer<typeof listSubmissionsSchema>;

// ---------------------------------------------------------------------------
// website.processSubmission
// ---------------------------------------------------------------------------

export const processSubmissionSchema = z.object({
  submissionId: z.string().uuid(),
});

export type ProcessSubmissionInput = z.infer<typeof processSubmissionSchema>;

// ---------------------------------------------------------------------------
// Public: contact form submission
// ---------------------------------------------------------------------------

export const contactFormSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(50).optional(),
  message: z.string().min(1).max(5000),
  vehicleId: z.string().uuid().optional(),
  honeypot: z.string().optional(), // Must be empty
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
