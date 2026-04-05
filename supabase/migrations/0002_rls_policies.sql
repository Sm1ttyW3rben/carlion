-- =============================================================================
-- Migration 0002: Row Level Security (RLS) Policies
-- =============================================================================
-- Tenant isolation enforced at DB level via RLS.
-- Policies use auth.jwt() — a built-in Supabase function that reads the
-- JWT passed in the Authorization header (or set via set_config).
--
-- In tRPC context (create-tenant-db.ts) we set:
--   set_config('request.jwt.claims', '{"tenant_id":"...","sub":"..."}', true)
-- auth.jwt() reads from request.jwt.claims automatically.
-- =============================================================================

-- =============================================================================
-- tenants table
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT
  USING (id = (auth.jwt() ->> 'tenant_id')::uuid);

-- =============================================================================
-- users table
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_tenant" ON users
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "users_insert_own_tenant" ON users
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "users_update_own_tenant" ON users
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- =============================================================================
-- ai_event_log — append-only for regular users
-- =============================================================================
ALTER TABLE ai_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_event_log_select_own_tenant" ON ai_event_log
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "ai_event_log_insert_own_tenant" ON ai_event_log
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- =============================================================================
-- audit_log — read-only for regular users, writes via SECURITY DEFINER function
-- =============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_own_tenant" ON audit_log
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Trusted function for writing audit log (bypasses RLS)
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_actor_type text,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_ip_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    tenant_id, actor_id, actor_type, action,
    resource_type, resource_id, ip_address
  ) VALUES (
    p_tenant_id, p_actor_id, p_actor_type, p_action,
    p_resource_type, p_resource_id, p_ip_address
  );
END;
$$;

-- =============================================================================
-- ai_action_commands
-- =============================================================================
ALTER TABLE ai_action_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_action_commands_select_own_tenant" ON ai_action_commands
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "ai_action_commands_insert_own_tenant" ON ai_action_commands
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "ai_action_commands_update_own_tenant" ON ai_action_commands
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- =============================================================================
-- outbox
-- =============================================================================
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox_select_own_tenant" ON outbox
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "outbox_insert_own_tenant" ON outbox
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- =============================================================================
-- files
-- =============================================================================
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "files_select_own_tenant" ON files
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "files_insert_own_tenant" ON files
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "files_update_own_tenant" ON files
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
