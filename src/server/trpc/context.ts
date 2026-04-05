import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createTenantDb, type JwtClaims } from "@/server/db/create-tenant-db";
import type { NextRequest } from "next/server";

export interface TrpcContext {
  userId: string;
  tenantId: string;
  role: string;
  db: ReturnType<typeof createTenantDb>["db"];
  // Called at the end of the request to release the DB connection
  cleanup: () => Promise<void>;
}

export interface PublicTrpcContext {
  // No auth — for public procedures
  db?: never;
}

// Called for every tRPC request.
// Extracts the user session from the Supabase cookie, validates it,
// and creates a per-request Drizzle client with RLS claim injection.
export async function createContext(req?: NextRequest): Promise<
  TrpcContext | PublicTrpcContext
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {};
  }

  // Extract custom claims set by the Supabase JWT hook (auth.users trigger)
  const jwt = session.access_token;
  const claims = decodeJwtClaims(jwt);

  if (!claims?.tenant_id || !claims?.sub) {
    return {};
  }

  const { db, setJwtClaims, cleanup } = createTenantDb({
    sub: claims.sub,
    tenant_id: claims.tenant_id,
    role: claims.role ?? "viewer",
  });

  // Inject claims into the DB session so RLS policies activate
  await setJwtClaims();

  return {
    userId: claims.sub,
    tenantId: claims.tenant_id,
    role: claims.role ?? "viewer",
    db,
    cleanup,
  };
}

// Decode JWT payload without verification (Supabase already verified it).
// We only need the claims — trust Supabase Auth for signature verification.
function decodeJwtClaims(
  token: string
): (JwtClaims & { exp?: number }) | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload) as JwtClaims & { exp?: number };
  } catch {
    return null;
  }
}
