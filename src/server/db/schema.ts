// Aggregated DB schema — all module schemas are re-exported here.
// Drizzle Kit reads this file for migrations.
// Module schemas are added here as they are built.

export * from "./schema/tenants";
export * from "./schema/users";
export * from "./schema/ai-event-log";
export * from "./schema/audit-log";
export * from "./schema/ai-action-commands";
export * from "./schema/outbox";
export * from "./schema/files";
export * from "@/modules/dna-engine/db/schema";
export * from "@/modules/inventory/db/schema";
export * from "@/modules/crm/db/schema";
export * from "@/modules/sales/db/schema";
export * from "@/modules/listings/db/schema";
