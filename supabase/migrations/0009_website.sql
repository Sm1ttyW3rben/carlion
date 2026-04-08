-- =============================================================================
-- Migration 0009: Website Builder (MOD 11)
-- =============================================================================
-- Creates tables, RLS policies, and indexes for the Website Builder module.
-- Includes CREATE TABLE so it can be applied via run-migrations.ts directly
-- (db:push is blocked by Drizzle-Kit introspection bug on idx_contacts_email).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. CREATE TABLES (IF NOT EXISTS — idempotent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS website_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  hero_headline text,
  hero_subheadline text,
  hero_cta_text text,
  about_text text,
  contact_form_enabled boolean NOT NULL DEFAULT true,
  contact_form_recipients text[] NOT NULL DEFAULT '{}',
  meta_title text,
  meta_description text,
  google_analytics_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS website_contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id),
  processed boolean NOT NULL DEFAULT false,
  contact_id uuid REFERENCES contacts(id),
  ip_address text,
  honeypot text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 1. Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_contact_submissions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS policies — tenant isolation
-- ---------------------------------------------------------------------------

-- website_settings
CREATE POLICY "tenant_isolation_select" ON website_settings
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON website_settings
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON website_settings
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON website_settings
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- website_contact_submissions
CREATE POLICY "tenant_isolation_select" ON website_contact_submissions
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON website_contact_submissions
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON website_contact_submissions
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON website_contact_submissions
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- website_settings: tenant lookup (unique constraint already acts as index)
CREATE INDEX IF NOT EXISTS idx_website_settings_tenant
  ON website_settings (tenant_id);

-- website_contact_submissions: primary filter
CREATE INDEX IF NOT EXISTS idx_submissions_tenant
  ON website_contact_submissions (tenant_id, submitted_at DESC);

-- website_contact_submissions: unprocessed queue (inbox)
CREATE INDEX IF NOT EXISTS idx_submissions_unprocessed
  ON website_contact_submissions (tenant_id)
  WHERE processed = false;

-- website_contact_submissions: vehicle-based lookup
CREATE INDEX IF NOT EXISTS idx_submissions_vehicle
  ON website_contact_submissions (vehicle_id)
  WHERE vehicle_id IS NOT NULL;
