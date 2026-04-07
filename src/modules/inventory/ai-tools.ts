/**
 * Inventory AI Tools — exposed to the AI-Assistent
 *
 * Read tools: direct service calls (no confirmation needed)
 * Write tools: MUST go through propose() — never mutate directly
 *
 * Spec: MOD_02 Section 7
 *       01_ARCHITECTURE.md Section 6 (AI-Aktionsprotokoll)
 *       CLAUDE.md Rule 5: Every MVP module must expose ai-tools.ts
 *       CLAUDE.md Rule 4: Writing tools named propose_* never call service mutations directly
 */

import type { AiTool, AiToolContext } from "@/modules/dna-engine/domain/types";
import * as inventoryService from "./services/inventory-service";
import * as aiCommandService from "@/shared/lib/ai-command-service";
import type { TrpcContext } from "@/server/trpc/context";

// ---------------------------------------------------------------------------
// Read tools (no confirmation required)
// ---------------------------------------------------------------------------

const listVehiclesTool: AiTool<{
  status?: string | string[];
  make?: string;
  model?: string;
  fuel_type?: string;
  price_min?: number;
  price_max?: number;
  limit?: number;
}> = {
  name: "list_vehicles",
  type: "read",
  description:
    "Fahrzeuge im Bestand auflisten und filtern. " +
    "Händler fragt z.B. 'Zeig mir alle verfügbaren BMWs' oder 'Welche Diesel haben wir?'",
  parameters: {
    status: { type: "string", description: "Status-Filter (z.B. 'available')" },
    make: { type: "string", description: "Marke" },
    model: { type: "string", description: "Modell" },
    fuel_type: { type: "string", description: "Kraftstoff" },
    price_min: { type: "number", description: "Mindestpreis" },
    price_max: { type: "number", description: "Maximalpreis" },
    limit: { type: "number", description: "Anzahl Ergebnisse (max 20)" },
  },
  execute: (params, ctx) =>
    inventoryService.list(
      {
        status: params.status as never,
        make: params.make,
        model: params.model,
        fuelType: params.fuel_type,
        priceMin: params.price_min,
        priceMax: params.price_max,
        limit: Math.min(params.limit ?? 20, 20),
        includeArchived: false,
        sortBy: "created_at",
        sortOrder: "desc",
      },
      ctx as unknown as TrpcContext
    ),
};

const getVehicleDetailsTool: AiTool<{ id?: string; search?: string }> = {
  name: "get_vehicle_details",
  type: "read",
  description:
    "Details eines bestimmten Fahrzeugs abrufen. " +
    "Händler fragt z.B. 'Was kostet der schwarze Golf?' oder 'Zeig mir den BMW mit der ID ...'",
  parameters: {
    id: { type: "string", description: "Fahrzeug-ID (UUID)" },
    search: { type: "string", description: "Freitext-Suche" },
  },
  execute: async (params, ctx) => {
    if (params.id) {
      return inventoryService.getById(params.id, ctx as unknown as TrpcContext);
    }
    if (params.search) {
      return inventoryService.list(
        {
          search: params.search,
          limit: 5,
          includeArchived: false,
          sortBy: "created_at",
          sortOrder: "desc",
        },
        ctx as unknown as TrpcContext
      );
    }
    return { items: [], nextCursor: null };
  },
};

const getInventoryStatsTool: AiTool<Record<string, never>> = {
  name: "get_inventory_stats",
  type: "read",
  description:
    "Bestandskennzahlen abrufen. " +
    "Händler fragt z.B. 'Wie viele Autos haben wir?' oder 'Was ist die durchschnittliche Standzeit?'",
  parameters: {},
  execute: (_, ctx) => inventoryService.getStats(ctx as unknown as TrpcContext),
};

const generateVehicleDescriptionTool: AiTool<{ vehicle_id: string }> = {
  name: "generate_vehicle_description",
  type: "read",
  description:
    "AI-Beschreibung für ein Fahrzeug generieren. " +
    "Gibt Vorschlag zurück, speichert nicht. Händler übernimmt manuell.",
  parameters: {
    vehicle_id: { type: "string", description: "Fahrzeug-ID (UUID)" },
  },
  execute: (params, ctx) =>
    inventoryService.generateDescription(params.vehicle_id, ctx as unknown as TrpcContext),
};

// ---------------------------------------------------------------------------
// Write tools — MUST use propose()
// ---------------------------------------------------------------------------

const proposeVehicleCreateTool: AiTool<{
  make: string;
  model: string;
  variant?: string;
  asking_price_gross?: string;
  mileage_km?: number;
  fuel_type?: string;
}> = {
  name: "propose_vehicle_create",
  type: "write",
  description:
    "Neues Fahrzeug anlegen vorschlagen. " +
    "Händler sagt z.B. 'Leg einen neuen BMW 320d an, 180.000 km, 12.500 Euro'",
  parameters: {
    make: { type: "string", description: "Marke (Pflicht)" },
    model: { type: "string", description: "Modell (Pflicht)" },
    variant: { type: "string", description: "Variante" },
    asking_price_gross: { type: "string", description: "Verkaufspreis brutto" },
    mileage_km: { type: "number", description: "Kilometerstand" },
    fuel_type: { type: "string", description: "Kraftstoff" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    const input = {
      make: params.make,
      model: params.model,
      variant: params.variant,
      askingPriceGross: params.asking_price_gross,
      mileageKm: params.mileage_km,
      fuelType: params.fuel_type,
      equipment: [],
      equipmentCodes: [],
      taxType: "margin" as const,
      source: "manual" as const,
    };
    return aiCommandService.propose(
      {
        module: "inventory",
        action: "create_vehicle",
        proposedChanges: input,
        preview: async () => ({
          action: "Neues Fahrzeug anlegen",
          vehicle: `${params.make} ${params.model}`,
          price: params.asking_price_gross ? `${params.asking_price_gross} €` : "kein Preis",
        }),
        executeOnConfirm: () => inventoryService.create(input, trpcCtx),
      },
      trpcCtx
    );
  },
};

const proposeVehicleStatusChangeTool: AiTool<{
  vehicle_id: string;
  status: string;
  reserved_for_contact_id?: string;
}> = {
  name: "propose_vehicle_status_change",
  type: "write",
  description:
    "Fahrzeugstatus ändern vorschlagen. " +
    "Händler sagt z.B. 'Der BMW ist verkauft' oder 'Reserviere den Golf für Müller'",
  parameters: {
    vehicle_id: { type: "string", description: "Fahrzeug-ID (UUID)" },
    status: {
      type: "string",
      description: "Neuer Status: draft | in_preparation | available | reserved | sold | delivered | archived",
    },
    reserved_for_contact_id: {
      type: "string",
      description: "Kontakt-ID — Pflicht wenn status = 'reserved'",
    },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose(
      {
        module: "inventory",
        action: "update_vehicle_status",
        proposedChanges: params,
        preview: async () => ({
          action: "Fahrzeugstatus ändern",
          vehicleId: params.vehicle_id,
          newStatus: params.status,
        }),
        executeOnConfirm: () =>
          inventoryService.updateStatus(
            {
              id: params.vehicle_id,
              status: params.status as never,
              reservedForContactId: params.reserved_for_contact_id,
            },
            trpcCtx
          ),
      },
      trpcCtx
    );
  },
};

const proposeVehiclePriceChangeTool: AiTool<{
  vehicle_id: string;
  asking_price_gross: string;
}> = {
  name: "propose_vehicle_price_change",
  type: "write",
  description:
    "Fahrzeugpreis ändern vorschlagen. " +
    "Händler sagt z.B. 'Setz den BMW auf 14.900 Euro'",
  parameters: {
    vehicle_id: { type: "string", description: "Fahrzeug-ID (UUID)" },
    asking_price_gross: { type: "string", description: "Neuer Verkaufspreis brutto" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose(
      {
        module: "inventory",
        action: "update_vehicle_price",
        proposedChanges: params,
        preview: async () => ({
          action: "Fahrzeugpreis ändern",
          vehicleId: params.vehicle_id,
          newPrice: `${params.asking_price_gross} €`,
        }),
        executeOnConfirm: () =>
          inventoryService.update(
            { id: params.vehicle_id, askingPriceGross: params.asking_price_gross },
            trpcCtx
          ),
      },
      trpcCtx
    );
  },
};

const proposeVehiclePublishTool: AiTool<{ vehicle_id: string }> = {
  name: "propose_vehicle_publish",
  type: "write",
  description:
    "Fahrzeug veröffentlichen vorschlagen. " +
    "Händler sagt z.B. 'Stell den Golf online' oder 'Veröffentliche das Fahrzeug'",
  parameters: {
    vehicle_id: { type: "string", description: "Fahrzeug-ID (UUID)" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose(
      {
        module: "inventory",
        action: "publish_vehicle",
        proposedChanges: params,
        preview: async () => ({
          action: "Fahrzeug veröffentlichen",
          vehicleId: params.vehicle_id,
          note: "Fahrzeug wird auf Website und Börsen sichtbar",
        }),
        executeOnConfirm: () => inventoryService.publish(params.vehicle_id, trpcCtx),
      },
      trpcCtx
    );
  },
};

// ---------------------------------------------------------------------------
// Export all tools
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const inventoryTools: AiTool<any>[] = [
  // Read (4)
  listVehiclesTool,
  getVehicleDetailsTool,
  getInventoryStatsTool,
  generateVehicleDescriptionTool,
  // Write — propose_* (4)
  proposeVehicleCreateTool,
  proposeVehicleStatusChangeTool,
  proposeVehiclePriceChangeTool,
  proposeVehiclePublishTool,
];
