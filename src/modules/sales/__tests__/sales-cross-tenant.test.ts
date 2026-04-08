/**
 * Sales Cross-Tenant Isolation Test
 *
 * Rule 21: "Cross-Tenant-Tests sind Pflicht. Bei jeder tenant-spezifischen
 * Ressource existiert ein Test: Tenant A sieht nie Daten von Tenant B."
 *
 * Uses real DB + RLS via createTenantDb — same pattern as rls-spike.test.ts.
 * Run: pnpm test:run src/modules/sales/__tests__/sales-cross-tenant.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "@/server/db/schema";
import { createTenantDb } from "@/server/db/create-tenant-db";
import { randomUUID } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set to run cross-tenant tests.\n" +
      "Copy .env.local.example to .env.local and fill in your Supabase credentials."
  );
}

const SLUG_PREFIX = "mod-sales";

// Service-role client — for test setup/teardown only, never in production handlers
const serviceClient = postgres(DATABASE_URL, { max: 5 });
const serviceDb = drizzle(serviceClient, { schema });

let tenantAId: string;
let tenantBId: string;
let userAId: string;
let userBId: string;
let dealBId: string; // Tenant B's deal — Tenant A must never see this

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestTenant(name: string): Promise<string> {
  const [tenant] = await serviceDb
    .insert(schema.tenants)
    .values({
      name,
      slug: `${SLUG_PREFIX}-${name.toLowerCase().replace(/\s/g, "-")}-${Date.now()}`,
      plan: "trial",
      status: "trial",
    })
    .returning({ id: schema.tenants.id });
  if (!tenant) throw new Error(`Failed to create tenant: ${name}`);
  return tenant.id;
}

async function createTestUser(tenantId: string): Promise<string> {
  const userId = randomUUID();
  await serviceDb.insert(schema.users).values({
    id: userId,
    tenantId,
    email: `test-${userId}@sales-cross-tenant.local`,
    role: "owner",
  });
  return userId;
}

async function cleanupTestData() {
  // Delete in FK-safe order: stage history → deals → interests/activities → contacts → vehicles → users → tenants
  await serviceDb.execute(sql`
    DELETE FROM deal_stage_history
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-sales-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM deals
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-sales-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM contact_vehicle_interests
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-sales-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM contact_activities
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-sales-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM contacts
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-sales-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM vehicles
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-sales-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM users
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-sales-%')
  `);
  await serviceDb.execute(sql`DELETE FROM tenants WHERE slug LIKE 'mod-sales-%'`);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Sales — Cross-Tenant Isolation (Rule 21)", () => {
  beforeAll(async () => {
    await cleanupTestData();

    tenantAId = await createTestTenant("Autohaus Alpha");
    tenantBId = await createTestTenant("Autohaus Beta");
    userAId = await createTestUser(tenantAId);
    userBId = await createTestUser(tenantBId);

    // Create prerequisites for Tenant B's deal via service role
    const [contact] = await serviceDb
      .insert(schema.contacts)
      .values({
        tenantId: tenantBId,
        lastName: "Mustermann",
        contactType: "prospect",
        source: "manual",
        country: "DE",
        tags: [],
        marketingConsent: false,
      })
      .returning({ id: schema.contacts.id });
    if (!contact) throw new Error("Failed to create test contact for Tenant B");

    const [vehicle] = await serviceDb
      .insert(schema.vehicles)
      .values({ tenantId: tenantBId, make: "BMW", model: "5er" })
      .returning({ id: schema.vehicles.id });
    if (!vehicle) throw new Error("Failed to create test vehicle for Tenant B");

    const [deal] = await serviceDb
      .insert(schema.deals)
      .values({
        tenantId: tenantBId,
        contactId: contact.id,
        vehicleId: vehicle.id,
        stage: "inquiry",
        financingRequested: false,
        priority: "normal",
        source: "manual",
      })
      .returning({ id: schema.deals.id });
    if (!deal) throw new Error("Failed to create test deal for Tenant B");
    dealBId = deal.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await serviceClient.end();
  });

  // -------------------------------------------------------------------------
  // Tenant A cannot see Tenant B's deals
  // -------------------------------------------------------------------------

  it("Tenant A CANNOT see Tenant B's deal by explicit ID lookup", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db
        .select()
        .from(schema.deals)
        .where(sql`id = ${dealBId}::uuid`);
      expect(result).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("SELECT * on deals returns only Tenant A's own rows (RLS without explicit WHERE)", async () => {
    // Create a deal for Tenant A so the table is non-empty from A's perspective
    const [contactA] = await serviceDb
      .insert(schema.contacts)
      .values({
        tenantId: tenantAId,
        lastName: "Schmidt",
        contactType: "prospect",
        source: "manual",
        country: "DE",
        tags: [],
        marketingConsent: false,
      })
      .returning({ id: schema.contacts.id });
    const [vehicleA] = await serviceDb
      .insert(schema.vehicles)
      .values({ tenantId: tenantAId, make: "Mercedes", model: "C-Klasse" })
      .returning({ id: schema.vehicles.id });

    if (!contactA || !vehicleA) throw new Error("Failed to create Tenant A prerequisites");

    await serviceDb.insert(schema.deals).values({
      tenantId: tenantAId,
      contactId: contactA.id,
      vehicleId: vehicleA.id,
      stage: "inquiry",
      financingRequested: false,
      priority: "normal",
      source: "manual",
    });

    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db.select().from(schema.deals);

      expect(result.length).toBeGreaterThan(0);
      for (const deal of result) {
        expect(deal.tenantId).toBe(tenantAId);
      }
    } finally {
      await cleanup();
    }
  });

  it("Tenant B CANNOT see Tenant A's deals (symmetric)", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userBId,
      tenant_id: tenantBId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db.select().from(schema.deals);

      const tenantARows = result.filter((d) => d.tenantId === tenantAId);
      expect(tenantARows).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("INSERT deal with wrong tenant_id is rejected by RLS WITH CHECK", async () => {
    // Need valid contact + vehicle IDs belonging to tenantB for the FK references
    const [contactB] = await serviceDb
      .select({ id: schema.contacts.id })
      .from(schema.contacts)
      .where(sql`tenant_id = ${tenantBId}::uuid`)
      .limit(1);
    const [vehicleB] = await serviceDb
      .select({ id: schema.vehicles.id })
      .from(schema.vehicles)
      .where(sql`tenant_id = ${tenantBId}::uuid`)
      .limit(1);

    if (!contactB || !vehicleB) throw new Error("Prerequisites not found for INSERT test");

    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      await expect(
        db.insert(schema.deals).values({
          tenantId: tenantBId, // wrong tenant — RLS must block this
          contactId: contactB.id,
          vehicleId: vehicleB.id,
          stage: "inquiry",
          financingRequested: false,
          priority: "normal",
          source: "manual",
        })
      ).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });
});
