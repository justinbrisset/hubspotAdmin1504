import { createHash } from 'crypto';
import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';
import { embedAndUpsert } from './embed';
import type { ChunkInput } from '@/types';

const DOCS_URL = 'https://developers.hubspot.com/docs/llms-full.txt';
const TENANT_ID = 'shared';
const DOC_TYPE = 'hubspot_docs';
const TARGET_CHUNK_TOKENS = 600; // ~600 tokens per chunk
const CHARS_PER_TOKEN = 4; // rough approximation

/**
 * Download HubSpot docs, check for changes, chunk, and embed.
 * Returns true if docs were updated, false if unchanged.
 */
export async function ingestHubSpotDocs(): Promise<{ updated: boolean; chunkCount: number }> {
  // Fetch the docs
  const res = await fetch(DOCS_URL);
  if (!res.ok) throw new Error(`Failed to fetch HubSpot docs: ${res.status}`);
  const content = await res.text();

  // Check content hash for change detection
  const hash = createHash('sha256').update(content).digest('hex');

  const existing = requireSupabaseData(
    await supabaseAdmin
      .from('document_chunks')
      .select('metadata')
      .eq('tenant_id', TENANT_ID)
      .eq('doc_type', DOC_TYPE)
      .limit(1)
      .maybeSingle(),
    'Failed to load existing documentation chunks'
  );

  if (existing?.metadata?.contentHash === hash) {
    return { updated: false, chunkCount: 0 };
  }

  // Split into chunks by sections (# headings)
  const chunks = chunkDocContent(content, hash);

  // Embed and upsert
  await embedAndUpsert(TENANT_ID, DOC_TYPE, chunks);

  return { updated: true, chunkCount: chunks.length };
}

/**
 * Split docs content into chunks, splitting on markdown headings.
 * Each chunk targets ~600 tokens. Large sections are split further.
 */
function chunkDocContent(content: string, contentHash: string): ChunkInput[] {
  const sections = content.split(/^(?=# )/m);
  const chunks: ChunkInput[] = [];
  const maxChars = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN;

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Extract heading for config_name
    const headingMatch = trimmed.match(/^#+ (.+)/);
    const heading = headingMatch?.[1] ?? 'HubSpot Documentation';

    if (trimmed.length <= maxChars) {
      chunks.push({
        tenantId: TENANT_ID,
        docType: DOC_TYPE,
        configName: heading,
        configId: `docs-${chunks.length}`,
        text: trimmed,
        metadata: { contentHash, section: heading },
      });
    } else {
      // Split large sections by paragraphs
      const paragraphs = trimmed.split(/\n\n+/);
      let buffer = '';

      for (const para of paragraphs) {
        if (buffer.length + para.length > maxChars && buffer.length > 0) {
          chunks.push({
            tenantId: TENANT_ID,
            docType: DOC_TYPE,
            configName: heading,
            configId: `docs-${chunks.length}`,
            text: buffer.trim(),
            metadata: { contentHash, section: heading },
          });
          buffer = '';
        }
        buffer += para + '\n\n';
      }

      if (buffer.trim()) {
        chunks.push({
          tenantId: TENANT_ID,
          docType: DOC_TYPE,
          configName: heading,
          configId: `docs-${chunks.length}`,
          text: buffer.trim(),
          metadata: { contentHash, section: heading },
        });
      }
    }
  }

  return chunks;
}
