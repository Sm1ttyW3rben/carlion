/**
 * Listings AI Tools — exposed to the AI-Assistent
 *
 * Read tools: direct service calls (no confirmation needed)
 * Write tools: MUST go through propose() — never mutate directly
 *
 * Spec: MOD_13 Section 7
 *       01_ARCHITECTURE.md Section 6 (AI-Aktionsprotokoll)
 *       CLAUDE.md Rule 5: Every MVP module must expose ai-tools.ts
 *       CLAUDE.md Rule 4: Writing tools named propose_* never call service mutations directly
 */

import type { AiTool, AiToolContext } from "@/modules/dna-engine/domain/types";
import * as listingsService from "./services/listings-service";
import * as aiCommandService from "@/shared/lib/ai-command-service";
import type { TrpcContext } from "@/server/trpc/context";

// ---------------------------------------------------------------------------
// Read tools (no confirmation required)
// ---------------------------------------------------------------------------

const getListingsStatsTool: AiTool<{ platform?: string }> = {
  name: "get_listings_stats",
  type: "read",
  description:
    "Börsen-Statistiken abrufen: aktive Inserate, Anfragen, Views pro Börse. " +
    "Händler fragt z.B. 'Wie laufen unsere Inserate?' oder 'Wie viele Anfragen haben wir von mobile.de?'",
  parameters: {
    platform: { type: "string", description: "Börse filtern: 'mobile_de' oder 'autoscout24'" },
  },
  execute: (params, ctx) =>
    listingsService.getStats(
      { platform: params.platform as "mobile_de" | "autoscout24" | undefined },
      ctx as unknown as TrpcContext
    ),
};

const listListingsTool: AiTool<{
  platform?: string;
  sync_status?: string;
  limit?: number;
}> = {
  name: "list_listings",
  type: "read",
  description:
    "Börsen-Inserate auflisten. " +
    "Händler fragt z.B. 'Welche Fahrzeuge sind auf mobile.de?' oder 'Zeig mir Inserate mit Fehlern'",
  parameters: {
    platform: { type: "string", description: "Börse: 'mobile_de' oder 'autoscout24'" },
    sync_status: { type: "string", description: "Status: 'pending' | 'synced' | 'error' | 'deactivated'" },
    limit: { type: "number", description: "Anzahl (max 20)" },
  },
  execute: (params, ctx) =>
    listingsService.listListings(
      {
        platform: params.platform as "mobile_de" | "autoscout24" | undefined,
        syncStatus: params.sync_status as "pending" | "synced" | "error" | "deactivated" | undefined,
        limit: Math.min(params.limit ?? 20, 20),
        sortBy: "created_at",
        sortOrder: "desc",
      },
      ctx as unknown as TrpcContext
    ),
};

const listInquiriesTool: AiTool<{
  platform?: string;
  processed?: boolean;
  limit?: number;
}> = {
  name: "list_inquiries",
  type: "read",
  description:
    "Börsen-Anfragen auflisten. " +
    "Händler fragt z.B. 'Welche neuen Anfragen haben wir?' oder 'Zeig mir unbearbeitete Anfragen von AutoScout'",
  parameters: {
    platform: { type: "string", description: "Börse filtern" },
    processed: { type: "boolean", description: "true = bearbeitete, false = offene Anfragen" },
    limit: { type: "number", description: "Anzahl (max 20)" },
  },
  execute: (params, ctx) =>
    listingsService.listInquiries(
      {
        platform: params.platform as "mobile_de" | "autoscout24" | undefined,
        processed: params.processed,
        limit: Math.min(params.limit ?? 20, 20),
      },
      ctx as unknown as TrpcContext
    ),
};

// ---------------------------------------------------------------------------
// Write tools — MUST use propose()
// ---------------------------------------------------------------------------

const proposeCreateListingTool: AiTool<{
  vehicle_id: string;
  platform: string;
}> = {
  name: "propose_create_listing",
  type: "write",
  description:
    "Inserat auf einer Börse schalten vorschlagen. " +
    "Händler sagt z.B. 'Stell den BMW auf mobile.de' oder 'Schalte das Inserat auf AutoScout'",
  parameters: {
    vehicle_id: { type: "string", description: "Fahrzeug-ID (UUID)" },
    platform: { type: "string", description: "'mobile_de' oder 'autoscout24'" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose(
      {
        module: "listings",
        action: "create_listing",
        proposedChanges: params,
        preview: async () => ({
          action: "Inserat schalten",
          vehicleId: params.vehicle_id,
          platform: params.platform === "mobile_de" ? "mobile.de" : "AutoScout24",
          note: "Fahrzeug wird auf der Börse inseriert",
        }),
        executeOnConfirm: () =>
          listingsService.createListing(
            {
              vehicleId: params.vehicle_id,
              platform: params.platform as "mobile_de" | "autoscout24",
            },
            trpcCtx
          ),
      },
      trpcCtx
    );
  },
};

const proposeDeactivateListingTool: AiTool<{
  listing_id: string;
}> = {
  name: "propose_deactivate_listing",
  type: "write",
  description:
    "Inserat deaktivieren vorschlagen. " +
    "Händler sagt z.B. 'Nimm das Inserat vom BMW runter' oder 'Deaktiviere das mobile.de Inserat'",
  parameters: {
    listing_id: { type: "string", description: "Inserat-ID (UUID)" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose(
      {
        module: "listings",
        action: "deactivate_listing",
        proposedChanges: params,
        preview: async () => ({
          action: "Inserat deaktivieren",
          listingId: params.listing_id,
          note: "Inserat wird von der Börse entfernt",
        }),
        executeOnConfirm: () =>
          listingsService.deactivateListing({ listingId: params.listing_id }, trpcCtx),
      },
      trpcCtx
    );
  },
};

// ---------------------------------------------------------------------------
// Export all tools
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const listingsTools: AiTool<any>[] = [
  // Read (3)
  getListingsStatsTool,
  listListingsTool,
  listInquiriesTool,
  // Write — propose_* (2)
  proposeCreateListingTool,
  proposeDeactivateListingTool,
];
