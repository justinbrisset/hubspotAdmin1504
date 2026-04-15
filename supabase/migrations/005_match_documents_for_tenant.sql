-- ============================================================
-- Explicit tenant-scoped document retrieval for server-side chat.
-- ============================================================

CREATE OR REPLACE FUNCTION match_documents_for_tenant(
  target_tenant_id TEXT,
  query_embedding TEXT,
  match_count INT DEFAULT 10,
  min_similarity FLOAT DEFAULT 0.5,
  filter_doc_types TEXT[] DEFAULT NULL,
  filter_object_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  tenant_id TEXT,
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
    dc.tenant_id,
    dc.chunk_text,
    dc.doc_type,
    dc.object_type,
    dc.config_name,
    dc.config_id,
    dc.metadata,
    (1 - (dc.embedding <=> query_vec))::FLOAT AS similarity
  FROM document_chunks dc
  WHERE
    (dc.tenant_id = target_tenant_id OR dc.tenant_id = 'shared')
    AND (filter_doc_types IS NULL OR dc.doc_type = ANY(filter_doc_types))
    AND (filter_object_types IS NULL OR dc.object_type = ANY(filter_object_types))
    AND (1 - (dc.embedding <=> query_vec)) >= min_similarity
  ORDER BY dc.embedding <=> query_vec
  LIMIT match_count;
END;
$$;
