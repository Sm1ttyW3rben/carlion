/**
 * tRPC client for React components.
 *
 * Usage:
 *   import { api } from "@/shared/lib/trpc/client";
 *   const { data } = api.dna.getBranding.useQuery();
 */

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/trpc/root";

export const api = createTRPCReact<AppRouter>();
