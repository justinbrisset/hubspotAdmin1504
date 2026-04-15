import type { ResourceType } from '@/types';
import { transformResourceData } from './transform';
import { embedAndUpsert } from './embed';

/**
 * Transform raw HubSpot data into natural-language chunks and embed them.
 * Maps resource types to their corresponding doc_type for the vector store.
 */
const RESOURCE_TO_DOCTYPE: Record<ResourceType, string> = {
  workflows: 'workflow',
  properties: 'property',
  pipelines: 'pipeline',
  forms: 'form',
  lists: 'list',
  marketing_emails: 'email_template',
  owners: 'owner',
};

export async function transformAndEmbed(
  tenantId: string,
  resourceType: ResourceType,
  data: unknown
): Promise<void> {
  const chunks = transformResourceData(tenantId, resourceType, data);
  const docType = RESOURCE_TO_DOCTYPE[resourceType];
  await embedAndUpsert(tenantId, docType, chunks);
}
