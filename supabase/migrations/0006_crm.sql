-- =============================================================================
-- Migration 0006: CRM & Kundenmanagement (MOD 01)
-- =============================================================================
-- Drizzle handles the CREATE TABLE statements.
-- This migration adds:
--   1. RLS policies (tenant isolation) on all 3 tables
--   2. CHECK constraints (business rules Drizzle cannot express)
--   3. Indexes (per spec MOD_01 Section 3)
--   4. UNIQUE constraint on contact_vehicle_interests
-- =============================================================================

-- =========================================================================
-- TABLE: contacts
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS policies — tenant isolation (spec: 01_ARCHITECTURE.md Section 3)
-- ---------------------------------------------------------------------------

CREATE POLICY "tenant_isolation_select" ON contacts
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON contacts
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON contacts
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON contacts
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints
-- ---------------------------------------------------------------------------

-- At least last_name OR company_name must be set
ALTER TABLE contacts
  ADD CONSTRAINT contacts_name_required
  CHECK (last_name IS NOT NULL OR company_name IS NOT NULL);

-- contact_type must be one of the defined values
ALTER TABLE contacts
  ADD CONSTRAINT contacts_type_valid
  CHECK (contact_type IN ('customer', 'prospect', 'seller', 'partner', 'other'));

-- source must be one of the defined values
ALTER TABLE contacts
  ADD CONSTRAINT contacts_source_valid
  CHECK (source IN ('manual', 'csv_import', 'whatsapp', 'mobile_de', 'autoscout24',
                    'website', 'phone', 'walk_in', 'referral', 'meta_ads'));

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_contacts_tenant
  ON contacts (tenant_id);

CREATE INDEX idx_contacts_tenant_type
  ON contacts (tenant_id, contact_type);

CREATE INDEX idx_contacts_tenant_created
  ON contacts (tenant_id, created_at DESC);

CREATE INDEX idx_contacts_tenant_name
  ON contacts (tenant_id, last_name, first_name);

CREATE INDEX idx_contacts_email
  ON contacts (tenant_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX idx_contacts_phone
  ON contacts (tenant_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX idx_contacts_phone_mobile
  ON contacts (tenant_id, phone_mobile)
  WHERE phone_mobile IS NOT NULL;

CREATE INDEX idx_contacts_whatsapp
  ON contacts (tenant_id, whatsapp_number)
  WHERE whatsapp_number IS NOT NULL;

CREATE INDEX idx_contacts_assigned
  ON contacts (tenant_id, assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX idx_contacts_interaction
  ON contacts (tenant_id, last_interaction_at DESC NULLS LAST);


-- =========================================================================
-- TABLE: contact_vehicle_interests
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE contact_vehicle_interests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS policies
-- ---------------------------------------------------------------------------

CREATE POLICY "tenant_isolation_select" ON contact_vehicle_interests
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON contact_vehicle_interests
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON contact_vehicle_interests
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON contact_vehicle_interests
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints
-- ---------------------------------------------------------------------------

ALTER TABLE contact_vehicle_interests
  ADD CONSTRAINT cvi_interest_type_valid
  CHECK (interest_type IN ('inquiry', 'test_drive', 'offer_requested', 'general'));

-- ---------------------------------------------------------------------------
-- 4. UNIQUE constraint + Indexes
-- ---------------------------------------------------------------------------

ALTER TABLE contact_vehicle_interests
  ADD CONSTRAINT cvi_unique_contact_vehicle
  UNIQUE (tenant_id, contact_id, vehicle_id);

CREATE INDEX idx_cvi_contact
  ON contact_vehicle_interests (tenant_id, contact_id);

CREATE INDEX idx_cvi_vehicle
  ON contact_vehicle_interests (tenant_id, vehicle_id);


-- =========================================================================
-- TABLE: contact_activities
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. RLS policies
-- ---------------------------------------------------------------------------

CREATE POLICY "tenant_isolation_select" ON contact_activities
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_insert" ON contact_activities
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_update" ON contact_activities
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_delete" ON contact_activities
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- 3. CHECK constraints
-- ---------------------------------------------------------------------------

ALTER TABLE contact_activities
  ADD CONSTRAINT activities_type_valid
  CHECK (activity_type IN ('note', 'call', 'email_in', 'email_out',
    'whatsapp_in', 'whatsapp_out', 'visit', 'test_drive', 'offer_sent',
    'deal_created', 'deal_won', 'deal_lost', 'vehicle_interest',
    'type_change', 'assignment_change'));

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_activities_contact
  ON contact_activities (tenant_id, contact_id, performed_at DESC);

CREATE INDEX idx_activities_vehicle
  ON contact_activities (tenant_id, vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX idx_activities_type
  ON contact_activities (tenant_id, activity_type, performed_at DESC);
