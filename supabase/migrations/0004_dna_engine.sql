-- =============================================================================
-- Migration 0004: DNA-Engine — RLS Policies + Indexes
-- =============================================================================
-- Tables are created by Drizzle Kit (pnpm db:generate && pnpm db:migrate).
-- This file adds:
--   1. RLS policies for tenant isolation
--   2. Partial unique index for crawl concurrency (Drizzle cannot express WHERE)
--   3. Additional composite indexes
-- =============================================================================

-- =============================================================================
-- tenant_branding table
-- =============================================================================
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_branding_select_own_tenant" ON tenant_branding
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_branding_insert_own_tenant" ON tenant_branding
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_branding_update_own_tenant" ON tenant_branding
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_branding_delete_own_tenant" ON tenant_branding
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- tenant_branding indexes
-- (The UNIQUE constraint on tenant_id is already created by Drizzle's .unique())
CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant
  ON tenant_branding(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_completeness
  ON tenant_branding(tenant_id, completeness);

-- =============================================================================
-- dna_crawl_results table
-- =============================================================================
ALTER TABLE dna_crawl_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dna_crawl_results_select_own_tenant" ON dna_crawl_results
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "dna_crawl_results_insert_own_tenant" ON dna_crawl_results
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "dna_crawl_results_update_own_tenant" ON dna_crawl_results
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "dna_crawl_results_delete_own_tenant" ON dna_crawl_results
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Partial unique index: max 1 active crawl per tenant at a time.
-- Drizzle cannot express WHERE clauses in uniqueIndex() — created here instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_active_per_tenant
  ON dna_crawl_results(tenant_id)
  WHERE status IN ('pending', 'crawling', 'analyzing');

-- Regular indexes
CREATE INDEX IF NOT EXISTS idx_crawl_tenant
  ON dna_crawl_results(tenant_id);

CREATE INDEX IF NOT EXISTS idx_crawl_tenant_status
  ON dna_crawl_results(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_crawl_tenant_created
  ON dna_crawl_results(tenant_id, created_at DESC);
