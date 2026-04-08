/**
 * Sales AI Tools — exposed to the AI-Assistent
 * Spec: MOD_03 Section 9
 */

import type { AiTool } from "@/modules/dna-engine/domain/types";
import * as salesService from "./services/sales-service";
import * as aiCommandService from "@/shared/lib/ai-command-service";
import type { TrpcContext } from "@/server/trpc/context";

const listDealsTool: AiTool<{
  stage?: string | string[];
  is_open?: boolean;
  assigned_to_user_name?: string;
  contact_name?: string;
  vehicle_search?: string;
  limit?: number;
}> = {
  name: "list_deals",
  type: "read",
  description: "Verkaufsvorgänge auflisten. Händler fragt z.B. 'Welche offenen Deals haben wir?' oder 'Zeig mir alle Angebote'",
  parameters: {
    stage: { type: "string", description: "Phase(n): inquiry, contacted, viewing, offer, negotiation, won, lost" },
    is_open: { type: "boolean", description: "Nur offene Deals?" },
    contact_name: { type: "string", description: "Kontaktname" },
    vehicle_search: { type: "string", description: "Fahrzeug-Suche" },
    limit: { type: "number", description: "Max Ergebnisse" },
  },
  execute: (params, ctx) =>
    salesService.list({
      stage: params.stage as never,
      isOpen: params.is_open,
      search: params.contact_name ?? params.vehicle_search,
      limit: Math.min(params.limit ?? 20, 20),
      sortBy: "created_at",
      sortOrder: "desc",
    }, ctx as unknown as TrpcContext),
};

const getDealDetailsTool: AiTool<{ id?: string; search?: string }> = {
  name: "get_deal_details",
  type: "read",
  description: "Details eines Verkaufsvorgangs abrufen.",
  parameters: {
    id: { type: "string", description: "Deal-ID (UUID)" },
    search: { type: "string", description: "Freitext-Suche" },
  },
  execute: async (params, ctx) => {
    if (params.id) return salesService.getById(params.id, ctx as unknown as TrpcContext);
    if (params.search) return salesService.list({ search: params.search, limit: 5, sortBy: "created_at", sortOrder: "desc" }, ctx as unknown as TrpcContext);
    return { items: [], nextCursor: null };
  },
};

const getSalesStatsTool: AiTool<{ period?: string }> = {
  name: "get_sales_stats",
  type: "read",
  description: "Verkaufskennzahlen abrufen. Händler fragt z.B. 'Wie ist die Abschlussrate?'",
  parameters: { period: { type: "string", description: "Zeitraum: month, quarter, year" } },
  execute: (params, ctx) =>
    salesService.getStats({ period: (params.period as "month" | "quarter" | "year") ?? "month" }, ctx as unknown as TrpcContext),
};

const proposeDealCreateTool: AiTool<{
  contact_id: string;
  vehicle_id: string;
  offered_price?: number;
  internal_notes?: string;
}> = {
  name: "propose_deal_create",
  type: "write",
  description: "Neuen Verkaufsvorgang vorschlagen.",
  parameters: {
    contact_id: { type: "string", description: "Kontakt-ID" },
    vehicle_id: { type: "string", description: "Fahrzeug-ID" },
    offered_price: { type: "number", description: "Angebotspreis" },
    internal_notes: { type: "string", description: "Interne Notizen" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    const input = { contactId: params.contact_id, vehicleId: params.vehicle_id, offeredPrice: params.offered_price, internalNotes: params.internal_notes, tags: [] as string[], source: "manual" as const, priority: "normal" as const, financingRequested: false };
    return aiCommandService.propose({ module: "sales", action: "create_deal", proposedChanges: input,
      preview: async () => ({ action: "Neuen Verkaufsvorgang anlegen", contactId: params.contact_id, vehicleId: params.vehicle_id }),
      executeOnConfirm: () => salesService.create(input, trpcCtx),
    }, trpcCtx);
  },
};

const proposeDealStageChangeTool: AiTool<{
  id: string;
  stage: string;
  notes?: string;
  lost_reason?: string;
  final_price?: number;
}> = {
  name: "propose_deal_stage_change",
  type: "write",
  description: "Verkaufsvorgang in nächste Phase verschieben.",
  parameters: {
    id: { type: "string", description: "Deal-ID" },
    stage: { type: "string", description: "Neue Phase" },
    notes: { type: "string", description: "Notizen" },
    lost_reason: { type: "string", description: "Verlustgrund (bei lost)" },
    final_price: { type: "number", description: "Abschlusspreis (bei won)" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose({ module: "sales", action: "move_to_stage", proposedChanges: params,
      preview: async () => ({ action: "Phase ändern", dealId: params.id, newStage: params.stage }),
      executeOnConfirm: () => salesService.moveToStage({ id: params.id, stage: params.stage as never, notes: params.notes, lostReason: params.lost_reason, finalPrice: params.final_price }, trpcCtx),
    }, trpcCtx);
  },
};

const proposeDealUpdateTool: AiTool<{
  id: string;
  offered_price?: number;
  priority?: string;
  financing_requested?: boolean;
  trade_in_vehicle?: string;
  trade_in_value?: number;
  internal_notes?: string;
}> = {
  name: "propose_deal_update",
  type: "write",
  description: "Konditionen eines Verkaufsvorgangs aktualisieren.",
  parameters: {
    id: { type: "string", description: "Deal-ID" },
    offered_price: { type: "number", description: "Angebotspreis" },
    priority: { type: "string", description: "Priorität" },
    financing_requested: { type: "boolean", description: "Finanzierung gewünscht?" },
    trade_in_vehicle: { type: "string", description: "Inzahlungnahme-Fahrzeug" },
    trade_in_value: { type: "number", description: "Inzahlungnahme-Wert" },
    internal_notes: { type: "string", description: "Notizen" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    return aiCommandService.propose({ module: "sales", action: "update_deal", proposedChanges: params,
      preview: async () => ({ action: "Vorgang aktualisieren", dealId: params.id }),
      executeOnConfirm: () => salesService.update({ id: params.id, offeredPrice: params.offered_price, priority: params.priority as never, financingRequested: params.financing_requested, tradeInVehicle: params.trade_in_vehicle, tradeInValue: params.trade_in_value, internalNotes: params.internal_notes }, trpcCtx),
    }, trpcCtx);
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const salesTools: AiTool<any>[] = [
  listDealsTool, getDealDetailsTool, getSalesStatsTool,
  proposeDealCreateTool, proposeDealStageChangeTool, proposeDealUpdateTool,
];
