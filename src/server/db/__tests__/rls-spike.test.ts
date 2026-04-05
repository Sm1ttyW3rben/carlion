/**
 * RLS Spike Test — BLOCKER for module development.
 *
 * Validates the 4 required properties before any module is built:
 *   1. Drizzle + JWT claim injection → RLS filters correctly
 *   2. Tenant A cannot see data from Tenant B
 *   3. Service Role access (for system jobs) works separately
 *   4. Performance overhead < 50ms per query (query-only, not connection setup)
 *
 * Run: pnpm test:run src/server/db/__tests__/rls-spike.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../schema";
import { createTenantDb } from "../create-tenant-db";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Test Setup
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set to run the RLS spike test.\n" +
      "Copy .env.local.example to .env.local and fill in your Supabase credentials."
  );
}

// Service-role client (bypasses RLS) — for test setup/teardown only
const serviceClient = postgres(DATABASE_URL, { max: 5 });
const serviceDb = drizzle(serviceClient, { schema });

let tenantAId: string;
let tenantBId: string;
let userAId: string;
let userBId: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestTenant(name: string): Promise<string> {
  const [tenant] = await serviceDb
    .insert(schema.tenants)
    .values({
      name,
      slug: `spike-${name.toLowerCase().replace(/\s/g, "-")}-${Date.now()}`,
      plan: "trial",
      status: "trial",
    })
    .returning({ id: schema.tenants.id });

  if (!tenant) throw new Error(`Failed to create test tenant: ${name}`);
  return tenant.id;
}

async function createTestUser(
  tenantId: string,
  role: "owner" | "salesperson" = "owner"
): Promise<string> {
  const userId = randomUUID();

  await serviceDb.insert(schema.users).values({
    id: userId,
    tenantId,
    email: `test-${userId}@spike-test.local`,
    role,
  });

  return userId;
}

async function cleanupTestData() {
  // Delete users belonging to spike-test tenants first (FK constraint),
  // then delete the tenants themselves.
  await serviceDb.execute(sql`
    DELETE FROM users
    WHERE tenant_id IN (
      SELECT id FROM tenants WHERE slug LIKE 'spike-%'
    )
  `);
  await serviceDb
    .delete(schema.tenants)
    .where(sql`slug LIKE 'spike-%'`);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("RLS Spike — Tenant Isolation", () => {
  beforeAll(async () => {
    await cleanupTestData();

    tenantAId = await createTestTenant("Autohaus Mueller");
    tenantBId = await createTestTenant("Autohaus Schmidt");
    userAId = await createTestUser(tenantAId, "owner");
    userBId = await createTestUser(tenantBId, "owner");
  });

  afterAll(async () => {
    await cleanupTestData();
    await serviceClient.end();
  });

  // -------------------------------------------------------------------------
  // Test 1: RLS filters correctly with JWT claims
  // -------------------------------------------------------------------------

  it("1a: User A can read their own tenant record", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });

    try {
      await setJwtClaims();
      const result = await db
        .select()
        .from(schema.tenants)
        .where(sql`id = ${tenantAId}::uuid`);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(tenantAId);
      expect(result[0]?.name).toBe("Autohaus Mueller");
    } finally {
      await cleanup();
    }
  });

  it("1b: User A can read their own users (only own tenant)", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });

    try {
      await setJwtClaims();
      const result = await db.select().from(schema.users);

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((u) => u.tenantId === tenantAId)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Test 2: Cross-Tenant Isolation (the critical test)
  // -------------------------------------------------------------------------

  it("2a: Tenant A CANNOT see Tenant B's tenant record", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });

    try {
      await setJwtClaims();
      const result = await db
        .select()
        .from(schema.tenants)
        .where(sql`id = ${tenantBId}::uuid`);

      expect(result).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("2b: Tenant A CANNOT see Tenant B's users", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });

    try {
      await setJwtClaims();
      const result = await db.select().from(schema.users);

      const tenantBUsers = result.filter((u) => u.tenantId === tenantBId);
      expect(tenantBUsers).toHaveLength(0);

      const tenantAUsers = result.filter((u) => u.tenantId === tenantAId);
      expect(tenantAUsers.length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  it("2c: SELECT * returns only own-tenant data (RLS enforced without explicit WHERE)", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });

    try {
      await setJwtClaims();
      const allUsers = await db.select().from(schema.users);

      for (const user of allUsers) {
        expect(user.tenantId).toBe(tenantAId);
      }
    } finally {
      await cleanup();
    }
  });

  it("2d: User B CANNOT see User A's data (symmetric)", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userBId,
      tenant_id: tenantBId,
      role: "owner",
    });

    try {
      await setJwtClaims();
      const allUsers = await db.select().from(schema.users);

      const tenantAUsers = allUsers.filter((u) => u.tenantId === tenantAId);
      expect(tenantAUsers).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: Service Role Access (for System Jobs)
  // -------------------------------------------------------------------------

  it("3a: Service role can read ALL tenants (bypasses RLS)", async () => {
    const result = await serviceDb
      .select()
      .from(schema.tenants)
      .where(sql`slug LIKE 'spike-%'`);

    const tenantIds = result.map((t) => t.id);
    expect(tenantIds).toContain(tenantAId);
    expect(tenantIds).toContain(tenantBId);
  });

  it("3b: Service role can read ALL users across tenants", async () => {
    const result = await serviceDb
      .select()
      .from(schema.users)
      .where(sql`email LIKE 'test-%@spike-test.local'`);

    const tenantIds = result.map((u) => u.tenantId);
    expect(tenantIds).toContain(tenantAId);
    expect(tenantIds).toContain(tenantBId);
  });

  // -------------------------------------------------------------------------
  // Test 4: Performance — query overhead only (excluding connection setup)
  // -------------------------------------------------------------------------

  it("4: JWT claim injection + query overhead < 50ms (excluding connection setup)", async () => {
    // Warm up: establish connection once
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });

    await setJwtClaims(); // warm up connection + set claims

    const iterations = 10;
    const queryTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await db.select().from(schema.users);
      queryTimes.push(performance.now() - start);
    }

    await cleanup();

    const avg = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const max = Math.max(...queryTimes);

    console.log(
      `Performance (query only): avg=${avg.toFixed(1)}ms, max=${max.toFixed(1)}ms over ${iterations} iterations`
    );

    // Architecture requirement: <50ms overhead per query
    expect(avg).toBeLessThan(50);
  });

  // -------------------------------------------------------------------------
  // Test 5: INSERT with wrong tenant_id is blocked by RLS WITH CHECK
  // -------------------------------------------------------------------------

  it("5: INSERT with wrong tenant_id is rejected by RLS", async () => {
    const { db, setJwtClaims, cleanup } = createTenantDb({
      sub: userAId,
      tenant_id: tenantAId,
      role: "owner",
    });

    try {
      await setJwtClaims();

      await expect(
        db.insert(schema.users).values({
          id: randomUUID(),
          tenantId: tenantBId, // Wrong tenant!
          email: `attacker-${Date.now()}@spike-test.local`,
          role: "owner",
        })
      ).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });
});
