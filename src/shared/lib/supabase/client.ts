"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — for auth state, realtime subscriptions.
// Data mutations go through tRPC → server → Supabase server client (with RLS).
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
