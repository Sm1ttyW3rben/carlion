-- MOD 17: WhatsApp Integration
-- Tables: webhook_log, whatsapp_connections, whatsapp_conversations, whatsapp_messages
-- Spec: MOD_17 Section 3

-- ---------------------------------------------------------------------------
-- webhook_log (shared infrastructure, no RLS — system-level table)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       text,
  service        text NOT NULL,
  payload        jsonb NOT NULL,
  processed      boolean NOT NULL DEFAULT false,
  processed_at   timestamptz,
  error_message  text,
  received_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_log_unprocessed
  ON webhook_log (service, received_at)
  WHERE processed = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_log_event_id
  ON webhook_log (event_id)
  WHERE event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- whatsapp_connections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id   text,
  display_phone     text NOT NULL,
  waba_id           text NOT NULL,
  connection_status text NOT NULL DEFAULT 'disconnected'
                    CHECK (connection_status IN ('disconnected', 'connected', 'error')),
  last_error        text,
  webhook_verified  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz
);

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_select" ON whatsapp_connections
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_insert" ON whatsapp_connections
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_update" ON whatsapp_connections
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_delete" ON whatsapp_connections
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ---------------------------------------------------------------------------
-- whatsapp_conversations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id            uuid NOT NULL REFERENCES contacts(id),
  remote_phone          text NOT NULL,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived')),
  unread_count          integer NOT NULL DEFAULT 0,
  last_message_at       timestamptz,
  last_message_preview  text,
  reply_window_expires  timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz,

  UNIQUE (tenant_id, contact_id),
  UNIQUE (tenant_id, remote_phone)
);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_select" ON whatsapp_conversations
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_insert" ON whatsapp_conversations
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_update" ON whatsapp_conversations
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_delete" ON whatsapp_conversations
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant
  ON whatsapp_conversations (tenant_id, COALESCE(last_message_at, created_at) DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_contact
  ON whatsapp_conversations (tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone
  ON whatsapp_conversations (tenant_id, remote_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_unread
  ON whatsapp_conversations (tenant_id)
  WHERE unread_count > 0;

-- ---------------------------------------------------------------------------
-- whatsapp_messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES whatsapp_conversations(id),
  direction           text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type        text NOT NULL DEFAULT 'text'
                      CHECK (message_type IN ('text','image','document','audio','video','location','contact','sticker','unknown')),
  body                text,
  media_url           text,
  media_mime_type     text,
  media_file_id       uuid REFERENCES files(id),
  external_message_id text,
  send_status         text CHECK (send_status IN ('sending','sent','delivered','read','failed')),
  send_error          text,
  activity_created    boolean NOT NULL DEFAULT false,
  sent_by             uuid REFERENCES users(id),
  timestamp           timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_select" ON whatsapp_messages
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_insert" ON whatsapp_messages
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_update" ON whatsapp_messages
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY IF NOT EXISTS "tenant_isolation_delete" ON whatsapp_messages
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON whatsapp_messages (tenant_id, conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pending_activity
  ON whatsapp_messages (tenant_id)
  WHERE activity_created = false AND send_status IN ('sent', 'delivered', 'read');
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external
  ON whatsapp_messages (tenant_id, external_message_id)
  WHERE external_message_id IS NOT NULL;
