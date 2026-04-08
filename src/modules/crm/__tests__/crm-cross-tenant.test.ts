/**
 * CRM Cross-Tenant Isolation Test
 *
 * Rule 21: "Cross-Tenant-Tests sind Pflicht. Bei jeder tenant-spezifischen
 * Ressource existiert ein Test: Tenant A sieht nie Daten von Tenant B."
 *
 * Uses real DB + RLS via createTenantDb — same pattern as rls-spike.test.ts.
 * Run: pnpm test:run src/modules/crm/__tests__/crm-cross-tenant.test.ts
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

const SLUG_PREFIX = "mod-crm";

// Service-role client — for test setup/teardown only, never in production handlers
const serviceClient = postgres(DATABASE_URL, { max: 5 });
const serviceDb = drizzle(serviceClient, { schema });

let tenantAId: string;
let tenantBId: string;
let userAId: string;
let userBId: string;
let contactBId: string; // Tenant B's contact — Tenant A must never see this

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
    email: `test-${userId}@crm-cross-tenant.local`,
    role: "owner",
  });
  return userId;
}

async function cleanupTestData() {
  await serviceDb.execute(sql`
    DELETE FROM contact_vehicle_interests
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-crm-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM contact_activities
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-crm-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM contacts
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-crm-%')
  `);
  await serviceDb.execute(sql`
    DELETE FROM users
    WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'mod-crm-%')
  `);
  await serviceDb.execute(sql`DELETE FROM tenants WHERE slug LIKE 'mod-crm-%'`);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("CRM — Cross-Tenant Isolation (Rule 21)", () => {
  beforeAll(async () => {
    await cleanupTestData();

    tenantAId = await createTestTenant("Autohaus Alpha");
    tenantBId = await createTestTenant("Autohaus Beta");
    userAId = await createTestUser(tenantAId);
    userBId = await createTestUser(tenantBId);

    // Create a contact for Tenant B via service role
    const [contact] = await serviceDb
      .insert(schema.contacts)
      .values({
        tenantId: tenantBId,
        lastName: "Mustermann",
        firstName: "Max",
        contactType: "prospect",
        source: "manual",
        country: "DE",
        tags: [],
        marketingConsent: false,
      })
      .returning({ id: schema.contacts.id });
    if (!contact) throw new Error("Failed to create test contact for Tenant B");
    contactBId = contact.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await serviceClient.end();
  });

  // -------------------------------------------------------------------------
  // Tenant A cannot see Tenant B's contacts
  // -------------------------------------------------------------------------

  it("Tenant A CANNOT see Tenant B's contact by explicit ID lookup", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db
        .select()
        .from(schema.contacts)
        .where(sql`id = ${contactBId}::uuid`);
      expect(result).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("SELECT * on contacts returns only Tenant A's own rows (RLS without explicit WHERE)", async () => {
    // Create a contact for Tenant A so the table is non-empty from A's perspective
    await serviceDb.insert(schema.contacts).values({
      tenantId: tenantAId,
      lastName: "Schmidt",
      contactType: "customer",
      source: "manual",
      country: "DE",
      tags: [],
      marketingConsent: false,
    });

    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db.select().from(schema.contacts);

      expect(result.length).toBeGreaterThan(0);
      for (const contact of result) {
        expect(contact.tenantId).toBe(tenantAId);
      }
    } finally {
      await cleanup();
    }
  });

  it("Tenant B CANNOT see Tenant A's contacts (symmetric)", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userBId,
      tenant_id: tenantBId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      const result = await db.select().from(schema.contacts);

      const tenantARows = result.filter((c) => c.tenantId === tenantAId);
      expect(tenantARows).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("INSERT contact with wrong tenant_id is rejected by RLS WITH CHECK", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });
    try {
      await setJwtClaims();
      await expect(
        db.insert(schema.contacts).values({
          tenantId: tenantBId, // wrong tenant — RLS must block this
          lastName: "Angreifer",
          contactType: "prospect",
          source: "manual",
          country: "DE",
          tags: [],
          marketingConsent: false,
        })
      ).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });
});
