/**
 * DNA-Engine AI Tools
 *
 * Tool definitions for the cross-module AI assistant.
 * Read tools execute directly. Write tools go through the PROPOSE → CONFIRM flow.
 *
 * Spec: MOD_34 Section 9
 *
 * Note: The aiCommandService (PROPOSE → CONFIRM flow) is implemented when the
 * AI assistant module is built. Write tools use a stub until then.
 */

import * as dnaService from "./services/dna-service";
import type { AiTool, AiToolContext, ToneEnum, FormalityEnum } from "./domain/types";
import type { TrpcContext } from "@/server/trpc/context";

// ---------------------------------------------------------------------------
// Read tools — no confirmation required
// ---------------------------------------------------------------------------

const getBrandingTool: AiTool = {
  name: "get_branding",
  description:
    "Branding-Profil des Autohauses abrufen: Farben, Logo, Tonalität, Kontaktdaten. " +
    "Nutze dieses Tool wenn der Händler nach seinen Markenfarben, dem Logo oder der Tonalität fragt.",
  type: "read",
  parameters: {},
  execute: async (_params, ctx) => {
    return dnaService.getBranding(ctx as TrpcContext);
  },
};

const regenerateBrandingTextTool: AiTool<{ field: string }> = {
  name: "regenerate_branding_text",
  description:
    "Einen AI-generierten Branding-Text neu generieren. " +
    "Händler sagt z.B. 'Generier mir eine neue Tagline' oder 'Schreib mir eine neue Willkommensnachricht'. " +
    "Gibt einen Vorschlag zurück — ändert NICHTS. Der Händler muss den Text selbst speichern.",
  type: "read",
  parameters: {
    field: {
      type: "string",
      enum: ["welcome_message", "email_signature", "tagline"],
      description: "Welcher Text neu generiert werden soll",
    },
  },
  execute: async ({ field }, ctx) => {
    const validFields = ["welcome_message", "email_signature", "tagline"] as const;
    type ValidField = (typeof validFields)[number];
    if (!validFields.includes(field as ValidField)) {
      throw new Error(`Ungültiges Feld: ${field}`);
    }
    return {
      field,
      suggestion: await dnaService.regenerateText(field as ValidField, ctx as TrpcContext),
    };
  },
};

// ---------------------------------------------------------------------------
// Write tools — PROPOSE → CONFIRM flow
//
// TODO: Replace stub with aiCommandService.propose() when the AI assistant
// module is built. Until then, these tools return a descriptive error so the
// assistant can inform the user that the feature is not yet available.
// ---------------------------------------------------------------------------

const proposeBrandingColorChangeTool: AiTool<{
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
}> = {
  name: "propose_branding_color_change",
  description:
    "Farbänderung vorschlagen. " +
    "Händler sagt z.B. 'Mach die Hauptfarbe blauer' oder 'Ändere die Primärfarbe auf Grün'. " +
    "Erzeugt einen Vorschlag den der Händler bestätigen muss — ändert nichts direkt.",
  type: "write",
  parameters: {
    primary_color: {
      type: "string",
      description: "Neue Primärfarbe als Hex (z.B. #2563EB)",
    },
    secondary_color: {
      type: "string",
      description: "Neue Sekundärfarbe als Hex",
    },
    accent_color: {
      type: "string",
      description: "Neue Akzentfarbe als Hex",
    },
  },
  execute: async (_params, _ctx) => {
    // TODO: Replace with aiCommandService.propose() when AI assistant module is built.
    // The propose flow:
    // 1. aiCommandService.propose({ module: "dna", action: "update_visual_identity", proposed_changes: params })
    // 2. Returns a confirm token valid for 5 minutes
    // 3. Frontend shows preview → user confirms → executeOnConfirm runs dnaService.updateVisualIdentity
    return {
      __stub: true,
      message:
        "Der PROPOSE→CONFIRM-Flow wird implementiert sobald der AI-Assistent-Modul gebaut wird. " +
        "Bitte nutze die Branding-Einstellungen direkt: /einstellungen/branding",
    };
  },
};

const proposeBrandingToneChangeTool: AiTool<{
  tone?: ToneEnum;
  formality?: FormalityEnum;
}> = {
  name: "propose_branding_tone_change",
  description:
    "Tonalität oder Anredeform ändern vorschlagen. " +
    "Händler sagt z.B. 'Wir wollen unsere Kunden duzen' oder 'Wechsel zu einem professionellen Ton'. " +
    "Erzeugt einen Vorschlag den der Händler bestätigen muss.",
  type: "write",
  parameters: {
    tone: {
      type: "string",
      enum: ["professional", "friendly", "premium", "casual"],
      description: "Neue Tonalität",
    },
    formality: {
      type: "string",
      enum: ["du", "sie"],
      description: "Anredeform",
    },
  },
  execute: async (_params, _ctx) => {
    // TODO: Replace with aiCommandService.propose() when AI assistant module is built.
    return {
      __stub: true,
      message:
        "Der PROPOSE→CONFIRM-Flow wird implementiert sobald der AI-Assistent-Modul gebaut wird. " +
        "Bitte nutze die Branding-Einstellungen direkt: /einstellungen/branding",
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

// Cast is safe: the array holds tools with different param shapes, the executor
// always validates the shape at runtime before using params.
export const dnaTools = [
  getBrandingTool,
  regenerateBrandingTextTool,
  proposeBrandingColorChangeTool,
  proposeBrandingToneChangeTool,
];
