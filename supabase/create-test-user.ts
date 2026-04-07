/**
 * Creates a real test user with Supabase Auth + Tenant + Branding.
 *
 * Run: pnpm tsx supabase/create-test-user.ts
 *
 * Test credentials:
 *   Email:    test@carlion.dev
 *   Passwort: Test1234!
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

const TEST_EMAIL = "test@carlion.dev";
const TEST_PASSWORD = "Test1234!";
const TENANT_NAME = "Demo Autohaus GmbH";
const TENANT_SLUG = "demo-autohaus";

async function main() {
  console.log("🚀 Test-User erstellen...\n");

  // 1. Existing user bereinigen
  const { data: existing } = await supabase.auth.admin.listUsers();
  const existingUser = existing?.users.find((u) => u.email === TEST_EMAIL);
  if (existingUser) {
    console.log("🧹 Bestehenden Test-User entfernen...");
    await supabase.auth.admin.deleteUser(existingUser.id);
    // Cascade über DB-FK: users → tenants → tenant_branding
  }

  // 2. Auth-User anlegen
  console.log("👤 Supabase Auth-User anlegen...");
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true, // Kein Bestätigungs-E-Mail nötig
  });

  if (authError || !authData.user) {
    throw new Error(`Auth-Fehler: ${authError?.message}`);
  }

  const authUserId = authData.user.id;
  console.log(`✅ Auth-User: ${authUserId}`);

  // 3. Tenant + User via DB-Funktion (Idempotent, unique slug)
  console.log("🏢 Tenant anlegen...");
  const { data: tenantData, error: tenantError } = await supabase.rpc(
    "create_tenant_and_user",
    {
      p_auth_user_id: authUserId,
      p_email: TEST_EMAIL,
      p_tenant_name: TENANT_NAME,
      p_tenant_slug: TENANT_SLUG,
    }
  );

  if (tenantError) {
    throw new Error(`Tenant-Fehler: ${tenantError.message}`);
  }

  const tenantId = (tenantData as { tenant_id: string; slug: string }).tenant_id;
  const slug = (tenantData as { tenant_id: string; slug: string }).slug;
  console.log(`✅ Tenant: ${tenantId} (slug: ${slug})`);

  // 4. Default tenant_branding anlegen (Platform Foundation Aufgabe, hier manuell)
  console.log("🎨 Standard-Branding anlegen...");
  await db
    .insert(schema.tenantBranding)
    .values({
      tenantId,
      primaryColor: "#2563EB",
      secondaryColor: "#1E40AF",
      backgroundColor: "#FFFFFF",
      textColor: "#1A1A1A",
      colorPalette: {},
      fontHeading: "Inter",
      fontBody: "Inter",
      borderRadius: "md",
      buttonStyle: "solid",
      tone: "professional",
      formality: "sie",
      dealershipType: "autohaus",
      descriptionStyle: "balanced",
      completeness: "draft",
    })
    .onConflictDoNothing();

  console.log("✅ Branding-Profil angelegt");

  console.log(`
╔══════════════════════════════════════════╗
║           Test-User bereit               ║
╠══════════════════════════════════════════╣
║  URL:      http://localhost:3000/login   ║
║  E-Mail:   ${TEST_EMAIL.padEnd(30)}║
║  Passwort: ${TEST_PASSWORD.padEnd(30)}║
║  Tenant:   ${TENANT_NAME.padEnd(30)}║
╚══════════════════════════════════════════╝
`);
}

main()
  .catch((err) => {
    console.error("❌ Fehler:", err);
    process.exit(1);
  })
  .finally(() => client.end());
