-- =============================================================================
-- Migration 0007: Verkauf & Lead-Pipeline (MOD 03)
-- =============================================================================

-- =========================================================================
-- TABLE: deals
-- =========================================================================

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "tenant_isolation_select" ON deals
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_insert" ON deals
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_update" ON deals
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_delete" ON deals
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- CHECK constraints
ALTER TABLE deals ADD CONSTRAINT deals_stage_valid
  CHECK (stage IN ('inquiry', 'contacted', 'viewing', 'offer', 'negotiation', 'won', 'lost'));

ALTER TABLE deals ADD CONSTRAINT deals_priority_valid
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

ALTER TABLE deals ADD CONSTRAINT deals_source_valid
  CHECK (source IN ('manual', 'whatsapp', 'mobile_de', 'autoscout24', 'website', 'phone', 'walk_in'));

ALTER TABLE deals ADD CONSTRAINT deals_final_price_only_won
  CHECK (final_price IS NULL OR stage = 'won');

ALTER TABLE deals ADD CONSTRAINT deals_lost_reason_only_lost
  CHECK (lost_reason IS NULL OR stage = 'lost');

ALTER TABLE deals ADD CONSTRAINT deals_offered_price_positive
  CHECK (offered_price IS NULL OR offered_price >= 0);

ALTER TABLE deals ADD CONSTRAINT deals_final_price_positive
  CHECK (final_price IS NULL OR final_price >= 0);

ALTER TABLE deals ADD CONSTRAINT deals_trade_in_value_positive
  CHECK (trade_in_value IS NULL OR trade_in_value >= 0);

-- Indexes
CREATE INDEX idx_deals_tenant ON deals(tenant_id);
CREATE INDEX idx_deals_tenant_stage ON deals(tenant_id, stage);
CREATE INDEX idx_deals_tenant_created ON deals(tenant_id, created_at DESC);
CREATE INDEX idx_deals_contact ON deals(tenant_id, contact_id);
CREATE INDEX idx_deals_vehicle ON deals(tenant_id, vehicle_id);
CREATE INDEX idx_deals_assigned ON deals(tenant_id, assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_deals_open ON deals(tenant_id, stage)
  WHERE stage NOT IN ('won', 'lost') AND deleted_at IS NULL;

-- Max 1 open deal per vehicle (partial unique index)
CREATE UNIQUE INDEX idx_deals_vehicle_open ON deals(tenant_id, vehicle_id)
  WHERE stage NOT IN ('won', 'lost') AND deleted_at IS NULL;


-- =========================================================================
-- TABLE: deal_stage_history
-- =========================================================================

ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON deal_stage_history
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_insert" ON deal_stage_history
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_update" ON deal_stage_history
  FOR UPDATE
  USING  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY "tenant_isolation_delete" ON deal_stage_history
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_stage_history_deal
  ON deal_stage_history(tenant_id, deal_id, changed_at DESC);
