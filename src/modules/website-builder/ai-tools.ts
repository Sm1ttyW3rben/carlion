/**
 * Website Builder AI Tools — exposed to the AI-Assistent
 *
 * Read tools: direct service calls (no confirmation needed)
 * Write tools: MUST go through propose() — never mutate directly
 *
 * Spec: MOD_11 Section 8
 *       CLAUDE.md Rule 5: Every MVP module must expose ai-tools.ts
 *       CLAUDE.md Rule 4: Writing tools named propose_* never call service mutations directly
 */

import type { AiTool } from "@/modules/dna-engine/domain/types";
import * as websiteService from "./services/website-service";
import * as aiCommandService from "@/shared/lib/ai-command-service";
import type { TrpcContext } from "@/server/trpc/context";

// ---------------------------------------------------------------------------
// Read tools (no confirmation required)
// ---------------------------------------------------------------------------

const getWebsiteStatusTool: AiTool<Record<string, never>> = {
  name: "get_website_status",
  type: "read",
  description:
    "Website-Status und Einstellungen abrufen. " +
    "Händler fragt z.B. 'Ist meine Website online?' oder 'Was steht auf meiner Website?'",
  parameters: {},
  execute: (_, ctx) => websiteService.getSettings(ctx as unknown as TrpcContext),
};

const listWebsiteSubmissionsTool: AiTool<{ processed?: boolean; limit?: number }> = {
  name: "list_website_submissions",
  type: "read",
  description:
    "Kontaktformular-Anfragen von der Website anzeigen. " +
    "Händler fragt z.B. 'Hat jemand über die Website geschrieben?' oder 'Neue Website-Anfragen?'",
  parameters: {
    processed: { type: "boolean", description: "true = bearbeitete, false = offene Anfragen" },
    limit: { type: "number", description: "Anzahl (max 20)" },
  },
  execute: (params, ctx) =>
    websiteService.listSubmissions(
      { processed: params.processed, limit: Math.min(params.limit ?? 20, 20) },
      ctx as unknown as TrpcContext
    ),
};

// ---------------------------------------------------------------------------
// Write tools — MUST use propose()
// ---------------------------------------------------------------------------

const proposeWebsitePublishTool: AiTool<Record<string, never>> = {
  name: "propose_website_publish",
  type: "write",
  description:
    "Website veröffentlichen vorschlagen. " +
    "Händler sagt z.B. 'Stell meine Website online' oder 'Aktiviere die Website'",
  parameters: {},
  execute: (_, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose(
      {
        module: "website",
        action: "publish_website",
        proposedChanges: {},
        preview: async () => ({
          action: "Website veröffentlichen",
          note: "Die Website wird öffentlich zugänglich",
        }),
        executeOnConfirm: () => websiteService.publish(trpcCtx),
      },
      trpcCtx
    );
  },
};

const proposeWebsiteTextChangeTool: AiTool<{
  hero_headline?: string;
  hero_subheadline?: string;
  about_text?: string;
  hero_cta_text?: string;
}> = {
  name: "propose_website_text_change",
  type: "write",
  description:
    "Website-Texte ändern vorschlagen. " +
    "Händler sagt z.B. 'Ändere den Willkommenstext auf der Website' oder 'Schreib einen neuen Über-uns-Text'",
  parameters: {
    hero_headline: { type: "string", description: "Hauptüberschrift der Startseite" },
    hero_subheadline: { type: "string", description: "Unterüberschrift der Startseite" },
    about_text: { type: "string", description: "Über-uns-Text" },
    hero_cta_text: { type: "string", description: "Button-Text (z.B. 'Bestand ansehen')" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    const input: Record<string, string | null> = {};
    if (params.hero_headline !== undefined) input.heroHeadline = params.hero_headline;
    if (params.hero_subheadline !== undefined) input.heroSubheadline = params.hero_subheadline;
    if (params.about_text !== undefined) input.aboutText = params.about_text;
    if (params.hero_cta_text !== undefined) input.heroCtatext = params.hero_cta_text;

    return aiCommandService.propose(
      {
        module: "website",
        action: "update_website_settings",
        proposedChanges: input,
        preview: async () => ({
          action: "Website-Texte ändern",
          changes: Object.keys(input).join(", "),
        }),
        executeOnConfirm: () => websiteService.updateSettings(input, trpcCtx),
      },
      trpcCtx
    );
  },
};

// ---------------------------------------------------------------------------
// Export all tools
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const websiteTools: AiTool<any>[] = [
  // Read (2)
  getWebsiteStatusTool,
  listWebsiteSubmissionsTool,
  // Write — propose_* (2)
  proposeWebsitePublishTool,
  proposeWebsiteTextChangeTool,
];
