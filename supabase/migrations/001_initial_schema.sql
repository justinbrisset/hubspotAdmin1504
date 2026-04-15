-- ============================================================
-- Enable pgvector
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TENANTS (clients)
-- ============================================================
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hubspot_portal_id TEXT NOT NULL UNIQUE,
  hubspot_access_token TEXT,
  hubspot_refresh_token TEXT,
  hubspot_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT CHUNKS (vector store)
-- ============================================================
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  object_type TEXT,
  config_name TEXT,
  config_id TEXT,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(768) NOT NULL,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_chunks_tenant_doctype ON document_chunks (tenant_id, doc_type);
CREATE INDEX idx_chunks_tenant_object ON document_chunks (tenant_id, object_type);

-- ============================================================
-- PORTAL SNAPSHOTS (raw JSON backups)
-- ============================================================
CREATE TABLE portal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_tenant ON portal_snapshots (tenant_id, resource_type, created_at DESC);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_invocations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_tenant ON messages (tenant_id, created_at DESC);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_state JSONB,
  after_state JSONB,
  proposal JSONB,
  reversible BOOLEAN DEFAULT TRUE,
  executed_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log (tenant_id, created_at DESC);

-- ============================================================
-- SYNC STATUS
-- ============================================================
CREATE TABLE sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  last_synced TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  items_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  UNIQUE(tenant_id, resource_type)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_chunks ON document_chunks FOR ALL
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR tenant_id = 'shared'
  );

CREATE POLICY tenant_isolation_snapshots ON portal_snapshots FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_conversations ON conversations FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_messages ON messages FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_audit ON audit_log FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_sync ON sync_status FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ============================================================
-- RPC: Set tenant context (transaction-local for PgBouncer)
-- ============================================================
CREATE OR REPLACE FUNCTION set_tenant(tid TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tid, true);
END;
$$;

-- ============================================================
-- RPC: Vector similarity search with metadata filtering
-- Accepts query_embedding as TEXT (JSON array string) because
-- Supabase JS client cannot send native VECTOR types via RPC.
-- ============================================================
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding TEXT,
  match_count INT DEFAULT 10,
  min_similarity FLOAT DEFAULT 0.5,
  filter_doc_types TEXT[] DEFAULT NULL,
  filter_object_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  chunk_text TEXT,
  doc_type TEXT,
  object_type TEXT,
  config_name TEXT,
  config_id TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_vec VECTOR(768);
BEGIN
  query_vec := query_embedding::vector(768);

  RETURN QUERY
  SELECT
    dc.id,
    dc.chunk_text,
    dc.doc_type,
    dc.object_type,
    dc.config_name,
    dc.config_id,
    dc.metadata,
    (1 - (dc.embedding <=> query_vec))::FLOAT AS similarity
  FROM document_chunks dc
  WHERE
    (dc.tenant_id = current_setting('app.tenant_id', true) OR dc.tenant_id = 'shared')
    AND (filter_doc_types IS NULL OR dc.doc_type = ANY(filter_doc_types))
    AND (filter_object_types IS NULL OR dc.object_type = ANY(filter_object_types))
    AND (1 - (dc.embedding <=> query_vec)) >= min_similarity
  ORDER BY dc.embedding <=> query_vec
  LIMIT match_count;
END;
$$;

-- ============================================================
-- RPC: Increment sync retry count on failure
-- ============================================================
CREATE OR REPLACE FUNCTION increment_sync_retry(tid TEXT, rtype TEXT, err_msg TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO sync_status (tenant_id, resource_type, status, error_message, retry_count)
  VALUES (tid, rtype, 'error', err_msg, 1)
  ON CONFLICT (tenant_id, resource_type)
  DO UPDATE SET
    status = 'error',
    error_message = err_msg,
    retry_count = sync_status.retry_count + 1;
END;
$$;

-- ============================================================
-- Seed: 'shared' tenant for HubSpot documentation
-- ============================================================
INSERT INTO tenants (id, name, hubspot_portal_id)
VALUES ('shared', 'HubSpot Documentation', 'N/A')
ON CONFLICT DO NOTHING;
