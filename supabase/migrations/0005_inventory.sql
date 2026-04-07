-- =============================================================================
-- Migration 0005: Fahrzeugverwaltung & Inventar (MOD 02)
-- =============================================================================
-- Drizzle handles the CREATE TABLE / ENUM statements.
-- This migration adds:
--   1. RLS policies (tenant isolation)
--   2. CHECK constraints (business rules Drizzle cannot express)
--   3. Indexes (including partial unique index for import idempotency)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS policies — tenant isolation (spec: 01_ARCHITECTURE.md Section 3)
-- ---------------------------------------------------------------------------

CREATE POLICY "tenant_isolation_select" ON vehicles
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON vehicles
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON vehicles
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON vehicles
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints (business rules)
-- ---------------------------------------------------------------------------

-- VIN must be exactly 17 characters when provided
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_vin_length
  CHECK (vin IS NULL OR length(vin) = 17);

-- Price must be non-negative when provided
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_asking_price_positive
  CHECK (asking_price_gross IS NULL OR asking_price_gross >= 0);

-- Mileage must be non-negative when provided
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_mileage_positive
  CHECK (mileage_km IS NULL OR mileage_km >= 0);

-- Publish guard: a vehicle may only be published when its status allows it
-- (last layer of defence; primary enforcement is in service layer)
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_published_status_guard
  CHECK (NOT (published = true AND status NOT IN ('available', 'reserved')));

-- ---------------------------------------------------------------------------
-- 4. Performance indexes
-- ---------------------------------------------------------------------------

-- Primary tenant filter
CREATE INDEX idx_vehicles_tenant
  ON vehicles (tenant_id);

-- Most common compound filter: tenant + status
CREATE INDEX idx_vehicles_tenant_status
  ON vehicles (tenant_id, status);

-- Default sort: newest first
CREATE INDEX idx_vehicles_tenant_created
  ON vehicles (tenant_id, created_at DESC);

-- VIN lookup (only rows that actually have a VIN)
CREATE INDEX idx_vehicles_vin
  ON vehicles (tenant_id, vin)
  WHERE vin IS NOT NULL;

-- Make/model typeahead / filter
CREATE INDEX idx_vehicles_make_model
  ON vehicles (tenant_id, make, model);

-- Public listing query: only published, non-deleted rows
CREATE INDEX idx_vehicles_published
  ON vehicles (tenant_id)
  WHERE published = true AND deleted_at IS NULL;

-- Standzeit (days_in_stock) sorting: sort by in_stock_since for active stock
CREATE INDEX idx_vehicles_in_stock
  ON vehicles (tenant_id, in_stock_since)
  WHERE status IN ('available', 'reserved');

-- ---------------------------------------------------------------------------
-- 5. Partial unique index — import idempotency (spec: MOD_02 Section 9)
-- ---------------------------------------------------------------------------
-- Prevents duplicate imports from the same external source.
-- source_reference IS NOT NULL guard allows multiple manual vehicles without conflict.

CREATE UNIQUE INDEX idx_vehicles_source_ref
  ON vehicles (tenant_id, source, source_reference)
  WHERE source_reference IS NOT NULL;
