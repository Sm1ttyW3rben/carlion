/**
 * SQL Migration Runner
 * Applies RLS policies and JWT hook to Supabase.
 *
 * Run: pnpm tsx supabase/run-migrations.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const db = postgres(DATABASE_URL, { max: 1 });

const migrations = [
  "supabase/migrations/0001_base_schema.sql",
  "supabase/migrations/0002_rls_policies.sql",
  "supabase/migrations/0003_jwt_claims_hook.sql",
  "supabase/migrations/0004_dna_engine.sql",
  "supabase/migrations/0005_inventory.sql",
  "supabase/migrations/0006_crm.sql",
  "supabase/migrations/0007_sales.sql",
];

async function run() {
  for (const file of migrations) {
    const sql = readFileSync(resolve(process.cwd(), file), "utf-8");
    console.log(`▶ Applying ${file}...`);
    try {
      await db.unsafe(sql);
      console.log(`✅ ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "already exists" errors are safe to ignore on re-runs
      if (msg.includes("already exists")) {
        console.log(`⚠️  ${file} — some objects already exist (safe to ignore)`);
      } else {
        throw err;
      }
    }
  }
  console.log("\n✅ All migrations applied.");
}

run()
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  })
  .finally(() => db.end());
