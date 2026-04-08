/**
 * CRM AI Tools — exposed to the AI-Assistent
 *
 * Read tools: direct service calls (no confirmation needed)
 * Write tools: MUST go through propose() — never mutate directly
 *
 * Spec: MOD_01 Section 6
 *       CLAUDE.md Rule 5: Every MVP module must expose ai-tools.ts
 *       CLAUDE.md Rule 4: Writing tools named propose_* never call service mutations directly
 */

import type { AiTool } from "@/modules/dna-engine/domain/types";
import * as crmService from "./services/crm-service";
import * as aiCommandService from "@/shared/lib/ai-command-service";
import type { TrpcContext } from "@/server/trpc/context";

// ---------------------------------------------------------------------------
// Read tools (no confirmation required)
// ---------------------------------------------------------------------------

const searchContactsTool: AiTool<{
  search?: string;
  contact_type?: string;
  tags?: string[];
  vehicle_id?: string;
}> = {
  name: "search_contacts",
  type: "read",
  description:
    "Kontakte suchen. " +
    "Händler fragt z.B. 'Wer hat sich für den Golf interessiert?' oder 'Zeig mir alle Kunden'",
  parameters: {
    search: { type: "string", description: "Freitext-Suche (Name, E-Mail, Telefon, Firma)" },
    contact_type: { type: "string", description: "Kontakttyp: customer, prospect, seller, partner, other" },
    tags: { type: "array", description: "Tags die der Kontakt haben muss" },
    vehicle_id: { type: "string", description: "Fahrzeug-ID — filtert Kontakte mit Interesse an diesem Fahrzeug" },
  },
  execute: (params, ctx) =>
    crmService.list(
      {
        search: params.search,
        contactType: params.contact_type as never,
        tags: params.tags,
        vehicleId: params.vehicle_id,
        limit: 20,
        sortBy: "created_at",
        sortOrder: "desc",
      },
      ctx as unknown as TrpcContext
    ),
};

const getContactDetailsTool: AiTool<{ id?: string; search?: string }> = {
  name: "get_contact_details",
  type: "read",
  description:
    "Details eines Kontakts abrufen. " +
    "Händler fragt z.B. 'Zeig mir Herrn Müller' oder 'Wer ist der Kontakt mit ID ...?'",
  parameters: {
    id: { type: "string", description: "Kontakt-ID (UUID)" },
    search: { type: "string", description: "Freitext-Suche" },
  },
  execute: async (params, ctx) => {
    if (params.id) {
      return crmService.getById(params.id, ctx as unknown as TrpcContext);
    }
    if (params.search) {
      return crmService.list(
        {
          search: params.search,
          limit: 5,
          sortBy: "created_at",
          sortOrder: "desc",
        },
        ctx as unknown as TrpcContext
      );
    }
    return { items: [], nextCursor: null };
  },
};

const getCrmStatsTool: AiTool<Record<string, never>> = {
  name: "get_crm_stats",
  type: "read",
  description:
    "CRM-Kennzahlen abrufen. " +
    "Händler fragt z.B. 'Wie viele Kontakte haben wir?' oder 'Wie viele Interessenten?'",
  parameters: {},
  execute: (_, ctx) => crmService.getStats(ctx as unknown as TrpcContext),
};

// ---------------------------------------------------------------------------
// Write tools — MUST use propose()
// ---------------------------------------------------------------------------

const proposeContactCreateTool: AiTool<{
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}> = {
  name: "propose_contact_create",
  type: "write",
  description:
    "Neuen Kontakt anlegen vorschlagen. " +
    "Händler sagt z.B. 'Leg einen neuen Kontakt an: Herr Müller, 0171-1234567'",
  parameters: {
    first_name: { type: "string", description: "Vorname" },
    last_name: { type: "string", description: "Nachname" },
    company_name: { type: "string", description: "Firmenname" },
    phone: { type: "string", description: "Telefonnummer" },
    email: { type: "string", description: "E-Mail" },
    notes: { type: "string", description: "Notizen" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    const input = {
      firstName: params.first_name,
      lastName: params.last_name,
      companyName: params.company_name,
      phone: params.phone,
      email: params.email,
      notes: params.notes,
      tags: [] as string[],
      country: "DE",
      contactType: "prospect" as const,
      source: "manual" as const,
      marketingConsent: false,
    };
    return aiCommandService.propose(
      {
        module: "crm",
        action: "create_contact",
        proposedChanges: input,
        preview: async () => ({
          action: "Neuen Kontakt anlegen",
          name: [params.first_name, params.last_name].filter(Boolean).join(" ") || params.company_name || "—",
          phone: params.phone ?? "—",
          email: params.email ?? "—",
        }),
        executeOnConfirm: () => crmService.create(input, trpcCtx),
      },
      trpcCtx
    );
  },
};

const proposeAddNoteTool: AiTool<{
  contact_id: string;
  title: string;
  description?: string;
  activity_type?: string;
}> = {
  name: "propose_add_note",
  type: "write",
  description:
    "Notiz zu einem Kontakt hinzufügen vorschlagen. " +
    "Händler sagt z.B. 'Vermerke bei Müller: hat morgen Termin'",
  parameters: {
    contact_id: { type: "string", description: "Kontakt-ID (UUID)" },
    title: { type: "string", description: "Titel der Notiz" },
    description: { type: "string", description: "Beschreibung" },
    activity_type: { type: "string", description: "Typ: note, call, visit etc. (default: note)" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    const input = {
      contactId: params.contact_id,
      activityType: (params.activity_type ?? "note") as "note",
      title: params.title,
      description: params.description,
    };
    return aiCommandService.propose(
      {
        module: "crm",
        action: "add_activity",
        proposedChanges: input,
        preview: async () => ({
          action: "Notiz hinzufügen",
          contactId: params.contact_id,
          title: params.title,
        }),
        executeOnConfirm: () => crmService.addActivity(input, trpcCtx),
      },
      trpcCtx
    );
  },
};

// TODO: propose_assign_contact — implementieren mit AI-Assistent-Modul

const proposeAddVehicleInterestTool: AiTool<{
  contact_id: string;
  vehicle_id: string;
  interest_type?: string;
}> = {
  name: "propose_add_vehicle_interest",
  type: "write",
  description:
    "Fahrzeug-Interesse für einen Kontakt hinzufügen. " +
    "Händler sagt z.B. 'Herr Müller interessiert sich für den BMW'",
  parameters: {
    contact_id: { type: "string", description: "Kontakt-ID (UUID)" },
    vehicle_id: { type: "string", description: "Fahrzeug-ID (UUID)" },
    interest_type: { type: "string", description: "Typ: inquiry, test_drive, offer_requested, general" },
  },
  execute: (params, ctx) => {
    const trpcCtx = ctx as unknown as TrpcContext;
    const input = {
      contactId: params.contact_id,
      vehicleId: params.vehicle_id,
      interestType: (params.interest_type ?? "inquiry") as "inquiry",
    };
    return aiCommandService.propose(
      {
        module: "crm",
        action: "add_vehicle_interest",
        proposedChanges: input,
        preview: async () => ({
          action: "Fahrzeug-Interesse hinzufügen",
          contactId: params.contact_id,
          vehicleId: params.vehicle_id,
          interestType: params.interest_type ?? "inquiry",
        }),
        executeOnConfirm: () => crmService.addVehicleInterest(input, trpcCtx),
      },
      trpcCtx
    );
  },
};

// ---------------------------------------------------------------------------
// Export all tools
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const crmTools: AiTool<any>[] = [
  // Read (3)
  searchContactsTool,
  getContactDetailsTool,
  getCrmStatsTool,
  // Write — propose_* (3)
  proposeContactCreateTool,
  proposeAddNoteTool,
  proposeAddVehicleInterestTool,
];
