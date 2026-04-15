import { EMBEDDING_MODEL_ID, openaiClient } from '@/lib/ai/models';
import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';
import type { ChatCitation, DocType, RetrievedDocument } from '@/types';

interface MatchDocumentsRow {
  id: string;
  tenant_id: string;
  chunk_text: string;
  doc_type: DocType;
  object_type: string | null;
  config_name: string | null;
  config_id: string | null;
  metadata: Record<string, unknown> | null;
  similarity: number;
}

function clipExcerpt(text: string, limit = 220): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit - 1)}...`;
}

function toRetrievedDocument(row: MatchDocumentsRow): RetrievedDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    chunkText: row.chunk_text,
    docType: row.doc_type,
    objectType: row.object_type,
    configName: row.config_name,
    configId: row.config_id,
    metadata: row.metadata ?? {},
    similarity: row.similarity,
  };
}

function toCitation(document: RetrievedDocument): ChatCitation {
  const sourceLabel =
    document.tenantId === 'shared'
      ? `HubSpot docs · ${String(document.metadata.section ?? document.configName ?? 'Reference')}`
      : `${document.configName ?? document.configId ?? document.docType} · ${document.docType}`;

  return {
    id: document.id,
    tenantId: document.tenantId,
    docType: document.docType,
    configName: document.configName,
    configId: document.configId,
    objectType: document.objectType,
    excerpt: clipExcerpt(document.chunkText),
    similarity: document.similarity,
    sourceLabel,
  };
}

async function embedQuery(query: string): Promise<number[]> {
  const response = await openaiClient.embeddings.create({
    model: EMBEDDING_MODEL_ID,
    input: query,
    dimensions: 768,
  });

  return response.data[0]?.embedding ?? [];
}

export async function searchDocuments({
  tenantId,
  query,
  matchCount = 8,
  minSimilarity = 0.35,
  docTypes,
  objectTypes,
}: {
  tenantId: string;
  query: string;
  matchCount?: number;
  minSimilarity?: number;
  docTypes?: DocType[];
  objectTypes?: string[];
}): Promise<RetrievedDocument[]> {
  const embedding = await embedQuery(query);

  const rows = requireSupabaseData(
    await supabaseAdmin.rpc('match_documents_for_tenant', {
      target_tenant_id: tenantId,
      query_embedding: JSON.stringify(embedding),
      match_count: matchCount,
      min_similarity: minSimilarity,
      filter_doc_types: docTypes ?? null,
      filter_object_types: objectTypes ?? null,
    }),
    `Failed to search documents for tenant "${tenantId}"`
  ) ?? [];

  return (rows as MatchDocumentsRow[]).map(toRetrievedDocument);
}

export async function searchPortalConfig({
  tenantId,
  query,
  matchCount = 8,
  objectTypes,
}: {
  tenantId: string;
  query: string;
  matchCount?: number;
  objectTypes?: string[];
}) {
  return searchDocuments({
    tenantId,
    query,
    matchCount,
    objectTypes,
    docTypes: ['workflow', 'property', 'pipeline', 'form', 'list', 'email_template', 'owner'],
  });
}

export async function searchHubSpotDocs({
  tenantId,
  query,
  matchCount = 4,
}: {
  tenantId: string;
  query: string;
  matchCount?: number;
}) {
  return searchDocuments({
    tenantId,
    query,
    matchCount,
    docTypes: ['hubspot_docs'],
  });
}

export async function retrieveContextForChat({
  tenantId,
  query,
}: {
  tenantId: string;
  query: string;
}): Promise<{ documents: RetrievedDocument[]; citations: ChatCitation[] }> {
  const [portalDocs, docs] = await Promise.all([
    searchPortalConfig({ tenantId, query, matchCount: 8 }),
    searchHubSpotDocs({ tenantId, query, matchCount: 4 }),
  ]);

  const ranked = [...portalDocs, ...docs]
    .sort((left, right) => {
      const leftScore = left.similarity + (left.tenantId === tenantId ? 0.03 : 0);
      const rightScore = right.similarity + (right.tenantId === tenantId ? 0.03 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 10);

  return {
    documents: ranked,
    citations: ranked.slice(0, 6).map(toCitation),
  };
}
