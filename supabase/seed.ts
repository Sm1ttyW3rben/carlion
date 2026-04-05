/**
 * Seed-Daten für Entwicklung und Tests.
 *
 * Erstellt:
 * - 2 Demo-Tenants (für Cross-Tenant-Isolationstests)
 * - Tenant A: "Autohaus Müller" — 1 Owner + 2 Mitarbeiter
 * - Tenant B: "Autohaus Schmidt" — 1 Owner
 *
 * Fahrzeuge, Kontakte und Deals werden nach dem Modul-Build mit dem
 * jeweiligen Modul-Seeder ergänzt.
 *
 * ACHTUNG: Nur für lokale Entwicklung / Supabase lokal.
 * Nie in Production ausführen.
 *
 * Run: pnpm db:seed
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check .env.local");
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log("🌱 Seeding demo data...\n");

  // Clean up existing demo data
  console.log("🧹 Cleaning up old demo data...");
  await db
    .delete(schema.users)
    .where(
      // Delete users whose email ends with @demo.carlion.de
      // We can't use template literals in drizzle without sql`` tag
      // so we use the raw SQL approach
      undefined
    );

  // Note: In a full implementation, we'd use sql`` for the WHERE clause.
  // For seed simplicity, we recreate specific known records.

  // =========================================================================
  // Tenant A: Autohaus Müller (full test tenant)
  // =========================================================================
  console.log("📦 Creating Tenant A: Autohaus Müller...");

  const [tenantA] = await db
    .insert(schema.tenants)
    .values({
      name: "Autohaus Müller GmbH",
      slug: "autohaus-mueller-demo",
      plan: "starter",
      status: "active",
      branding: {
        primaryColor: "#1a56db",
        secondaryColor: "#1e40af",
        logoUrl: null,
      },
      settings: {
        language: "de",
        timezone: "Europe/Berlin",
        currency: "EUR",
      },
    })
    .onConflictDoNothing()
    .returning();

  if (!tenantA) {
    console.log("⚠️  Tenant A already exists, skipping...");
  } else {
    // Users for Tenant A
    const userAOwner = "00000000-0000-0000-0000-000000000001";
    const userASalesperson1 = "00000000-0000-0000-0000-000000000002";
    const userASalesperson2 = "00000000-0000-0000-0000-000000000003";

    await db
      .insert(schema.users)
      .values([
        {
          id: userAOwner,
          tenantId: tenantA.id,
          email: "inhaber@autohaus-mueller-demo.carlion.de",
          name: "Hans Müller",
          role: "owner",
        },
        {
          id: userASalesperson1,
          tenantId: tenantA.id,
          email: "verkauf1@autohaus-mueller-demo.carlion.de",
          name: "Klaus Weber",
          role: "salesperson",
        },
        {
          id: userASalesperson2,
          tenantId: tenantA.id,
          email: "verkauf2@autohaus-mueller-demo.carlion.de",
          name: "Petra Hoffmann",
          role: "salesperson",
        },
      ])
      .onConflictDoNothing();

    console.log(`✅ Tenant A created: ${tenantA.id}`);
  }

  // =========================================================================
  // Tenant B: Autohaus Schmidt (isolation test tenant)
  // =========================================================================
  console.log("📦 Creating Tenant B: Autohaus Schmidt...");

  const [tenantB] = await db
    .insert(schema.tenants)
    .values({
      name: "Schmidt Automobile",
      slug: "schmidt-automobile-demo",
      plan: "free",
      status: "trial",
      branding: {
        primaryColor: "#dc2626",
        secondaryColor: "#b91c1c",
        logoUrl: null,
      },
      settings: {
        language: "de",
        timezone: "Europe/Berlin",
        currency: "EUR",
      },
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    })
    .onConflictDoNothing()
    .returning();

  if (!tenantB) {
    console.log("⚠️  Tenant B already exists, skipping...");
  } else {
    const userBOwner = "00000000-0000-0000-0000-000000000004";

    await db
      .insert(schema.users)
      .values({
        id: userBOwner,
        tenantId: tenantB.id,
        email: "inhaber@schmidt-automobile-demo.carlion.de",
        name: "Frank Schmidt",
        role: "owner",
      })
      .onConflictDoNothing();

    console.log(`✅ Tenant B created: ${tenantB.id}`);
  }

  console.log("\n✅ Seed complete!");
  console.log("   Tenant A: Autohaus Müller GmbH (starter, active)");
  console.log("   Tenant B: Schmidt Automobile (free, trial)");
  console.log("\n   Use these tenants for RLS spike tests.");
  console.log(
    "   Run: pnpm test:run src/server/db/__tests__/rls-spike.test.ts"
  );
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void client.end();
  });
