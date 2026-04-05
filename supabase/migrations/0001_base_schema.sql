-- =============================================================================
-- Migration 0001: Base Schema — Enums, Tables, Indexes
-- =============================================================================
-- Note: RLS policies are in 0002_rls_policies.sql
-- Note: JWT claims hook is in 0003_jwt_claims_hook.sql
-- Note: This migration is applied AFTER drizzle-kit generates the table DDL.
--       Run: pnpm db:migrate (applies drizzle migrations)
--       Then: supabase db push (applies this SQL migration)
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Indexes (Drizzle Kit handles tables + enums)
-- Drizzle does not automatically add composite indexes — we add them here.
-- Every tenant-specific table needs at minimum:
--   1. Index on tenant_id (covered by FK in Drizzle, but explicit is faster)
--   2. Composite index on (tenant_id, created_at) for time-based queries
-- =============================================================================

-- tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- users
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- ai_event_log
CREATE INDEX IF NOT EXISTS idx_ai_event_log_tenant_id ON ai_event_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_event_log_tenant_created ON ai_event_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_event_log_user_id ON ai_event_log(user_id);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- ai_action_commands
CREATE INDEX IF NOT EXISTS idx_ai_action_commands_tenant_id ON ai_action_commands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_commands_user_id ON ai_action_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_commands_status ON ai_action_commands(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_action_commands_token ON ai_action_commands(confirm_token) WHERE confirm_token IS NOT NULL;

-- outbox
CREATE INDEX IF NOT EXISTS idx_outbox_tenant_id ON outbox(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status_next ON outbox(status, next_attempt_at) WHERE status IN ('pending', 'failed');

-- files
CREATE INDEX IF NOT EXISTS idx_files_tenant_id ON files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_files_entity ON files(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_files_not_deleted ON files(tenant_id, entity_type, entity_id) WHERE deleted_at IS NULL;
