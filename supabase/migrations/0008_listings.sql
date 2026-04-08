-- =============================================================================
-- Migration 0008: Börsen-Hub (MOD 13)
-- =============================================================================
-- Since db:push is blocked by a Drizzle-Kit introspection bug on
-- idx_contacts_email, this migration also handles CREATE TABLE so we can apply
-- it entirely via pnpm db:sql (run-migrations.ts).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. CREATE TABLES (IF NOT EXISTS — idempotent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listing_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  platform text NOT NULL,
  api_key_encrypted text,
  dealer_id text,
  connection_status text NOT NULL DEFAULT 'disconnected',
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  platform text NOT NULL,
  external_id text,
  external_url text,
  sync_status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz,
  last_sync_error text,
  views_total integer NOT NULL DEFAULT 0,
  clicks_total integer NOT NULL DEFAULT 0,
  inquiries_total integer NOT NULL DEFAULT 0,
  last_performance_update timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS listing_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  listing_id uuid NOT NULL REFERENCES listings(id),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id),
  inquirer_name text,
  inquirer_email text,
  inquirer_phone text,
  message text,
  processed boolean NOT NULL DEFAULT false,
  contact_id uuid REFERENCES contacts(id),
  deal_id uuid,
  processing_notes text,
  platform text NOT NULL,
  external_inquiry_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  parsed_vehicles jsonb NOT NULL,
  parse_errors jsonb NOT NULL DEFAULT '[]',
  parse_warnings jsonb NOT NULL DEFAULT '[]',
  vehicle_count integer NOT NULL,
  duplicate_count integer NOT NULL DEFAULT 0,
  original_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on all listings tables
-- ---------------------------------------------------------------------------

ALTER TABLE listing_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS policies — tenant isolation (spec: 01_ARCHITECTURE.md Section 3)
-- ---------------------------------------------------------------------------

-- listing_connections
CREATE POLICY "tenant_isolation_select" ON listing_connections
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON listing_connections
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON listing_connections
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON listing_connections
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- listings
CREATE POLICY "tenant_isolation_select" ON listings
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON listings
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON listings
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON listings
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- listing_inquiries
CREATE POLICY "tenant_isolation_select" ON listing_inquiries
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON listing_inquiries
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON listing_inquiries
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- (No DELETE policy on inquiries — they are soft-archived via processed flag)

-- import_sessions
CREATE POLICY "tenant_isolation_select" ON import_sessions
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON import_sessions
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON import_sessions
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints (business rules)
-- ---------------------------------------------------------------------------

-- listing_connections: valid platform values
ALTER TABLE listing_connections
  ADD CONSTRAINT listing_connections_platform_check
  CHECK (platform IN ('mobile_de', 'autoscout24'));

-- listing_connections: valid connection_status values
ALTER TABLE listing_connections
  ADD CONSTRAINT listing_connections_status_check
  CHECK (connection_status IN ('disconnected', 'connected', 'draining', 'error'));

-- listings: valid platform values
ALTER TABLE listings
  ADD CONSTRAINT listings_platform_check
  CHECK (platform IN ('mobile_de', 'autoscout24'));

-- listings: valid sync_status values
ALTER TABLE listings
  ADD CONSTRAINT listings_sync_status_check
  CHECK (sync_status IN ('pending', 'synced', 'error', 'deactivated'));

-- listings: performance counters must be non-negative
ALTER TABLE listings
  ADD CONSTRAINT listings_views_positive
  CHECK (views_total >= 0);

ALTER TABLE listings
  ADD CONSTRAINT listings_clicks_positive
  CHECK (clicks_total >= 0);

ALTER TABLE listings
  ADD CONSTRAINT listings_inquiries_positive
  CHECK (inquiries_total >= 0);

-- listing_inquiries: valid platform values
ALTER TABLE listing_inquiries
  ADD CONSTRAINT listing_inquiries_platform_check
  CHECK (platform IN ('mobile_de', 'autoscout24'));

-- import_sessions: valid platform values
ALTER TABLE import_sessions
  ADD CONSTRAINT import_sessions_platform_check
  CHECK (platform IN ('mobile_de', 'autoscout24'));

-- import_sessions: valid status values
ALTER TABLE import_sessions
  ADD CONSTRAINT import_sessions_status_check
  CHECK (status IN ('pending', 'confirmed', 'expired'));

-- import_sessions: expires_at must be in the future at insert time
-- (enforced by application layer, no DB CHECK needed — expiresAt is computed)

-- ---------------------------------------------------------------------------
-- 4. Unique constraints
-- ---------------------------------------------------------------------------

-- One connection per (tenant, platform)
ALTER TABLE listing_connections
  ADD CONSTRAINT listing_connections_tenant_platform_unique
  UNIQUE (tenant_id, platform);

-- One listing per (tenant, vehicle, platform)
ALTER TABLE listings
  ADD CONSTRAINT listings_tenant_vehicle_platform_unique
  UNIQUE (tenant_id, vehicle_id, platform);

-- Inquiry deduplication: one inquiry per (tenant, platform, external_inquiry_id)
-- Only applies when external_inquiry_id is set (pulled via API)
CREATE UNIQUE INDEX idx_listing_inquiries_dedup
  ON listing_inquiries (tenant_id, platform, external_inquiry_id)
  WHERE external_inquiry_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Performance indexes
-- ---------------------------------------------------------------------------

-- listing_connections: tenant lookup
CREATE INDEX idx_listing_connections_tenant
  ON listing_connections (tenant_id);

-- listings: primary tenant filter
CREATE INDEX idx_listings_tenant
  ON listings (tenant_id);

-- listings: tenant + platform (platform filter in UI)
CREATE INDEX idx_listings_tenant_platform
  ON listings (tenant_id, platform);

-- listings: tenant + sync_status (error/pending dashboards)
CREATE INDEX idx_listings_tenant_status
  ON listings (tenant_id, sync_status);

-- listings: tenant + vehicle_id (quick vehicle-to-listing lookup)
CREATE INDEX idx_listings_vehicle
  ON listings (tenant_id, vehicle_id);

-- listings: default sort — newest first
CREATE INDEX idx_listings_tenant_created
  ON listings (tenant_id, created_at DESC);

-- listings: performance sort — most views first
CREATE INDEX idx_listings_tenant_views
  ON listings (tenant_id, views_total DESC);

-- listings: performance sync — find listings needing sync (reconcile cron)
CREATE INDEX idx_listings_pending_sync
  ON listings (tenant_id, sync_status, last_synced_at)
  WHERE sync_status IN ('pending', 'error');

-- listing_inquiries: primary tenant filter
CREATE INDEX idx_listing_inquiries_tenant
  ON listing_inquiries (tenant_id);

-- listing_inquiries: unprocessed queue (Anfragen-Inbox)
CREATE INDEX idx_listing_inquiries_unprocessed
  ON listing_inquiries (tenant_id, received_at DESC)
  WHERE processed = false;

-- listing_inquiries: vehicle-based lookup (from vehicle detail view)
CREATE INDEX idx_listing_inquiries_vehicle
  ON listing_inquiries (tenant_id, vehicle_id);

-- listing_inquiries: listing-based lookup
CREATE INDEX idx_listing_inquiries_listing
  ON listing_inquiries (listing_id);

-- import_sessions: tenant + expiry (cleanup cron)
CREATE INDEX idx_import_sessions_tenant_expires
  ON import_sessions (tenant_id, expires_at)
  WHERE status = 'pending';
