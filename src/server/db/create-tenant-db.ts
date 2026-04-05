import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export interface JwtClaims {
  sub: string;       // user UUID (= Supabase Auth user ID)
  tenant_id: string; // tenant UUID
  role: string;      // user role
}

// Per-request Drizzle client with RLS activation.
//
// Architecture: Option A — Supabase Client with User-JWT.
// Implemented via two steps on the PostgreSQL session:
//   1. SET ROLE authenticated — switches away from postgres superuser so RLS applies
//   2. set_config('request.jwt.claims', ..., false) — session-level so auth.jwt() reads it
//
// The postgres superuser bypasses RLS by default. Switching to 'authenticated'
// activates RLS. The JWT claims are read by auth.jwt() in all RLS policies.
//
// NEVER use this for system jobs or migrations — use server/db/index.ts instead.
export function createTenantDb(claims: JwtClaims) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(connectionString, {
    max: 1,
    transform: { undefined: null },
  });

  const db = drizzle(client, { schema });

  // Activates RLS for this session:
  //   1. Switch role to 'authenticated' (postgres superuser bypasses RLS)
  //   2. Inject JWT claims so auth.jwt() returns the correct tenant context
  //      — is_local=false means session-level (survives auto-commit boundaries)
  async function setJwtClaims() {
    const claimsJson = JSON.stringify(claims);

    await db.execute(sql`SET ROLE authenticated`);

    await db.execute(
      sql`SELECT set_config('request.jwt.claims', ${claimsJson}, false)`
    );
    await db.execute(
      sql`SELECT set_config('request.jwt.claim.sub', ${claims.sub}, false)`
    );
    await db.execute(
      sql`SELECT set_config('request.jwt.claim.tenant_id', ${claims.tenant_id}, false)`
    );
    await db.execute(
      sql`SELECT set_config('request.jwt.claim.role', ${claims.role}, false)`
    );
  }

  async function cleanup() {
    await client.end();
  }

  return { db, setJwtClaims, cleanup };
}
