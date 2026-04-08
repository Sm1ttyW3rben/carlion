/**
 * Listings Cross-Tenant Isolation Test
 *
 * Rule 21: "Cross-Tenant-Tests sind Pflicht. Bei jeder tenant-spezifischen
 * Ressource existiert ein Test: Tenant A sieht nie Daten von Tenant B."
 *
 * Uses real DB + RLS via createTenantDb — same pattern as rls-spike.test.ts.
 * Run: pnpm test:run src/modules/listings/__tests__/listings-cross-tenant.test.ts
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

const SLUG_PREFIX = "mod-lst";

// Service-role client — for test setup/teardown only, never in production handlers
const serviceClient = postgres(DATABASE_URL, { max: 5 });
const serviceDb = drizzle(serviceClient, { schema });

let tenantAId: string;
let tenantBId: string;
let userAId: string;
let userBId: string;
let vehicleBId: string;
let connectionBId: string; // Tenant B's listing connection — Tenant A must never see this
let listingBId: string;   // Tenant B's listing — Tenant A must never see this

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
    email: `test-${userId}@lst-cross-tenant.local`,
    role: "owner",
  });
  return userId;
}

async function cleanupTestData() {
  await serviceDb.execute(sql`
    DELETE FROM listing_inquiries
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-lst-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM import_sessions
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-lst-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM listings
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-lst-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM listing_connections
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-lst-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM vehicles
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-lst-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM users
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-lst-%')
  `);
  await serviceDb.execute(sql`DELETE FROM tenants WHERE slug LIKE 'mod-lst-%'`);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Listings — Cross-Tenant Isolation (Rule 21)", () => {
  beforeAll(async () => {
    await cleanupTestData();

    tenantAId = await createTestTenant("Börsen Alpha");
    tenantBId = await createTestTenant("Börsen Beta");
    userAId = await createTestUser(tenantAId);
    userBId = await createTestUser(tenantBId);

    // Create a vehicle for Tenant B (needed for the listing FK)
    const [vehicle] = await serviceDb
      .insert(schema.vehicles)
      .values({
        tenantId: tenantBId,
        make: "Toyota",
        model: "Corolla",
      })
      .returning({ id: schema.vehicles.id });
    if (!vehicle) throw new Error("Failed to create test vehicle for Tenant B");
    vehicleBId = vehicle.id;

    // Create a listing connection for Tenant B
    const [connection] = await serviceDb
      .insert(schema.listingConnections)
      .values({
        tenantId: tenantBId,
        platform: "mobile_de",
        connectionStatus: "connected",
      })
      .returning({ id: schema.listingConnections.id });
    if (!connection) throw new Error("Failed to create test connection for Tenant B");
    connectionBId = connection.id;

    // Create a listing for Tenant B
    const [listing] = await serviceDb
      .insert(schema.listings)
      .values({
        tenantId: tenantBId,
        vehicleId: vehicleBId,
        platform: "mobile_de",
        syncStatus: "synced",
        externalId: "stub-mde-123",
        externalUrl: "https://www.mobile.de/auto/stub-123",
      })
      .returning({ id: schema.listings.id });
    if (!listing) throw new Error("Failed to create test listing for Tenant B");
    listingBId = listing.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await serviceClient.end();
  });

  // -------------------------------------------------------------------------
  // listing_connections
  // -------------------------------------------------------------------------

  it("Tenant A CANNOT see Tenant B's listing_connection by explicit ID lookup", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db
        .select()
        .from(schema.listingConnections)
        .where(sql`id = ${connectionBId}::uuid`);
      expect(result).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // listings
  // -------------------------------------------------------------------------

  it("Tenant A CANNOT see Tenant B's listing by explicit ID lookup", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db
        .select()
        .from(schema.listings)
        .where(sql`id = ${listingBId}::uuid`);
      expect(result).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("SELECT * on listings returns only Tenant A's own rows (RLS without explicit WHERE)", async () => {
    // Create a listing for Tenant A so the table is non-empty from A's perspective
    const [vehicleA] = await serviceDb
      .insert(schema.vehicles)
      .values({ tenantId: tenantAId, make: "VW", model: "Polo" })
      .returning({ id: schema.vehicles.id });

    await serviceDb.insert(schema.listings).values({
      tenantId: tenantAId,
      vehicleId: vehicleA!.id,
      platform: "autoscout24",
      syncStatus: "pending",
    });

    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db.select().from(schema.listings);

      expect(result.length).toBeGreaterThan(0);
      for (const row of result) {
        expect(row.tenantId).toBe(tenantAId);
      }
    } finally {
      await cleanup();
    }
  });

  it("INSERT listing with wrong tenant_id is rejected by RLS WITH CHECK", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      await expect(
        db.insert(schema.listings).values({
          tenantId: tenantBId, // wrong tenant — RLS must block this
          vehicleId: vehicleBId,
          platform: "mobile_de",
          syncStatus: "pending",
        })
      ).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });
});
