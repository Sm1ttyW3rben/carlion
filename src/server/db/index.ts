import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// This direct connection is ONLY for:
// - Drizzle migrations (drizzle-kit)
// - Seed scripts
// - System/cron jobs that need Service Role access
//
// For all regular tenant requests, use the Supabase client (Option A from architecture).
// The per-request Drizzle client is created in server/trpc/context.ts using the user JWT.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
