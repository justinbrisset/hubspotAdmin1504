import OpenAI from 'openai';
import {
  requireSupabaseOk,
  supabaseAdmin,
} from '@/lib/supabase-admin';
import type { ChunkInput } from '@/types';

const openai = new OpenAI();

const EMBED_BATCH_SIZE = 512;
const INSERT_BATCH_SIZE = 100;

export async function embedAndUpsert(
  tenantId: string,
  docType: string,
  chunks: ChunkInput[]
): Promise<void> {
  if (chunks.length === 0) return;

  const syncRunId = crypto.randomUUID();
  const syncedAt = new Date().toISOString();

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map((c) => c.text);

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: 768,
    });

    const rows = batch.map((chunk, idx) => ({
      tenant_id: chunk.tenantId,
      doc_type: chunk.docType,
      object_type: chunk.objectType ?? null,
      config_name: chunk.configName,
      config_id: chunk.configId,
      chunk_text: chunk.text,
      chunk_index: i + idx,
      metadata: chunk.metadata,
      embedding: JSON.stringify(embeddingResponse.data[idx].embedding),
      last_synced: syncedAt,
      sync_run_id: syncRunId,
    }));

    for (let j = 0; j < rows.length; j += INSERT_BATCH_SIZE) {
      const insertBatch = rows.slice(j, j + INSERT_BATCH_SIZE);
      const insertResult = await supabaseAdmin.from('document_chunks').insert(insertBatch);
      requireSupabaseOk(insertResult, 'Failed to insert chunks');
    }
  }

  const deleteResult = await supabaseAdmin
    .from('document_chunks')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('doc_type', docType)
    .or(`sync_run_id.is.null,sync_run_id.neq.${syncRunId}`);

  requireSupabaseOk(deleteResult, 'Failed to prune stale document chunks');
}
