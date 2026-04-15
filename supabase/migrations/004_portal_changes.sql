-- ============================================================
-- Persist compact change summaries between snapshot versions.
-- ============================================================

CREATE TABLE portal_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  snapshot_id UUID NOT NULL UNIQUE REFERENCES portal_snapshots(id) ON DELETE CASCADE,
  previous_snapshot_id UUID REFERENCES portal_snapshots(id) ON DELETE SET NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portal_changes_tenant_resource
  ON portal_changes (tenant_id, resource_type, created_at DESC);

ALTER TABLE portal_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_portal_changes ON portal_changes FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));
