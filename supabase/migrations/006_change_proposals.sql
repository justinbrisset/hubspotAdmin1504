-- ============================================================
-- First-class proposal workflow for reviewable HubSpot changes.
-- ============================================================

CREATE TABLE change_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'rejected', 'applied', 'rolled_back')),
  source TEXT NOT NULL DEFAULT 'audit'
    CHECK (source IN ('audit', 'chat', 'manual')),
  risk_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high')),
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  reasoning TEXT NOT NULL DEFAULT '',
  changes JSONB NOT NULL DEFAULT '[]',
  doubts JSONB,
  alternative_approaches JSONB,
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  approved_by TEXT,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_change_proposals_tenant_status
  ON change_proposals (tenant_id, status, created_at DESC);

ALTER TABLE change_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_change_proposals ON change_proposals FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));
