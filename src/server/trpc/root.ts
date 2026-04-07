import { createTRPCRouter } from "./trpc";
import { createCallerFactory } from "./trpc";
import { dnaRouter } from "@/modules/dna-engine/api/router";
import { inventoryRouter } from "@/modules/inventory/api/router";

// Root router — module routers are registered here as they are built.
// Each module gets exactly one router under its namespace.
export const appRouter = createTRPCRouter({
  // Modules are added here in build order:
  dna: dnaRouter,              // Module 1: DNA-Engine
  inventory: inventoryRouter,  // Module 2: Fahrzeugverwaltung
  // crm: crmRouter,          ← Module 3: CRM
  // sales: salesRouter,      ← Module 4: Verkauf
  // listings: listingsRouter, ← Module 5: Börsen-Hub
  // website: websiteRouter,  ← Module 6: Website Builder
  // whatsapp: whatsappRouter, ← Module 7: WhatsApp
  // assistant: assistantRouter, ← AI Assistent (cross-module)
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
