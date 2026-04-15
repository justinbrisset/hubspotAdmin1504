-- ============================================================
-- Track document chunk sync runs so embeddings can be swapped
-- atomically after a successful re-embed.
-- ============================================================

ALTER TABLE document_chunks
  ADD COLUMN sync_run_id TEXT;

CREATE INDEX idx_chunks_sync_run
  ON document_chunks (tenant_id, doc_type, sync_run_id);
