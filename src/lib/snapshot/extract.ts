import { Client } from '@hubspot/api-client';
import {
  requireSupabaseOk,
  supabaseAdmin,
} from '@/lib/supabase-admin';
import type { ResourceType, ResourceSyncResult } from '@/types';

const PAGE_LIMIT = 100;
const LIST_PAGE_SIZE = 250;

type HubSpotResponse = Awaited<ReturnType<Client['apiRequest']>>;

interface WorkflowSummary {
  id?: string | number;
}

interface WorkflowPageResponse {
  results?: WorkflowSummary[];
  paging?: {
    next?: {
      after?: string;
    };
  };
}

interface WorkflowBatchReadResponse {
  results?: unknown[];
}

function getNextAfter(
  page: { paging?: { next?: { after?: string } } }
): string | undefined {
  return page.paging?.next?.after;
}

async function parseHubSpotResponse<T>(
  response: HubSpotResponse,
  context: string
): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${context}: ${message || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ---- Per-resource extraction functions ----

export async function syncWorkflows(hubspotClient: Client): Promise<unknown[]> {
  const workflows: unknown[] = [];
  let after: string | undefined;

  do {
    const page = await parseHubSpotResponse<WorkflowPageResponse>(
      await hubspotClient.apiRequest({
        method: 'GET',
        path: '/automation/v4/flows',
        qs: {
          limit: PAGE_LIMIT,
          ...(after ? { after } : {}),
        },
      }),
      'Failed to fetch HubSpot workflows'
    );

    const flowIds = (page.results ?? [])
      .map((workflow) => workflow.id)
      .filter((id): id is string | number => id !== undefined && id !== null)
      .map(String);

    if (flowIds.length > 0) {
      const details = await parseHubSpotResponse<WorkflowBatchReadResponse>(
        await hubspotClient.apiRequest({
          method: 'POST',
          path: '/automation/v4/flows/batch/read',
          body: {
            inputs: flowIds.map((flowId) => ({ flowId, type: 'FLOW_ID' })),
          },
        }),
        'Failed to fetch HubSpot workflow details'
      );

      workflows.push(...(details.results ?? []));
    }

    after = getNextAfter(page);
  } while (after);

  return workflows;
}

export async function syncProperties(hubspotClient: Client): Promise<Record<string, unknown[]>> {
  const properties: Record<string, unknown[]> = {};

  for (const objectType of ['contacts', 'companies', 'deals', 'tickets']) {
    const props = await hubspotClient.crm.properties.coreApi.getAll(objectType);
    properties[objectType] = props.results ?? [];
  }

  return properties;
}

export async function syncPipelines(hubspotClient: Client): Promise<Record<string, unknown[]>> {
  const pipelines: Record<string, unknown[]> = {};

  for (const objectType of ['deals', 'tickets']) {
    const pipes = await hubspotClient.crm.pipelines.pipelinesApi.getAll(objectType);
    pipelines[objectType] = pipes.results ?? [];
  }

  return pipelines;
}

export async function syncForms(hubspotClient: Client): Promise<unknown[]> {
  const forms: unknown[] = [];
  let after: string | undefined;

  do {
    const page = await hubspotClient.marketing.forms.formsApi.getPage(
      after,
      PAGE_LIMIT,
      false,
      ['hubspot']
    );

    forms.push(...(page.results ?? []));
    after = getNextAfter(page);
  } while (after);

  return forms;
}

export async function syncLists(hubspotClient: Client): Promise<unknown[]> {
  const lists: unknown[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await hubspotClient.crm.lists.listsApi.doSearch({
      query: '',
      count: LIST_PAGE_SIZE,
      offset,
    });

    const pageLists = page.lists ?? [];
    lists.push(...pageLists);

    hasMore = page.hasMore;
    const nextOffset =
      typeof page.offset === 'number' && page.offset > offset
        ? page.offset
        : offset + pageLists.length;

    if (!hasMore || nextOffset <= offset) {
      break;
    }

    offset = nextOffset;
  }

  return lists;
}

export async function syncMarketingEmails(hubspotClient: Client): Promise<unknown[]> {
  const emails: unknown[] = [];
  let after: string | undefined;

  do {
    const page = await hubspotClient.marketing.emails.marketingEmailsApi.getPage(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      after,
      PAGE_LIMIT
    );

    emails.push(...(page.results ?? []));
    after = getNextAfter(page);
  } while (after);

  return emails;
}

export async function syncOwners(hubspotClient: Client): Promise<unknown[]> {
  const owners: unknown[] = [];
  let after: string | undefined;

  do {
    const page = await hubspotClient.crm.owners.ownersApi.getPage(
      undefined,
      after,
      PAGE_LIMIT,
      false
    );

    owners.push(...(page.results ?? []));
    after = getNextAfter(page);
  } while (after);

  return owners;
}

// ---- Orchestrator ----

const RESOURCE_EXTRACTORS: Record<ResourceType, (client: Client) => Promise<unknown>> = {
  workflows: syncWorkflows,
  properties: syncProperties,
  pipelines: syncPipelines,
  forms: syncForms,
  lists: syncLists,
  marketing_emails: syncMarketingEmails,
  owners: syncOwners,
};

function countItems(data: unknown): number {
  if (Array.isArray(data)) return data.length;

  if (typeof data === 'object' && data !== null) {
    return Object.values(data).reduce(
      (count, value) => count + (Array.isArray(value) ? value.length : 0),
      0
    );
  }

  return 0;
}

export async function markSyncCompleted(
  tenantId: string,
  resourceType: ResourceType,
  itemsCount: number
): Promise<void> {
  const result = await supabaseAdmin
    .from('sync_status')
    .upsert(
      {
        tenant_id: tenantId,
        resource_type: resourceType,
        status: 'completed',
        last_synced: new Date().toISOString(),
        items_count: itemsCount,
        error_message: null,
        retry_count: 0,
      },
      { onConflict: 'tenant_id,resource_type' }
    );

  requireSupabaseOk(result, `Failed to mark ${resourceType} sync as completed`);
}

export async function markSyncFailed(
  tenantId: string,
  resourceType: ResourceType,
  errorMessage: string
): Promise<void> {
  const result = await supabaseAdmin.rpc('increment_sync_retry', {
    tid: tenantId,
    rtype: resourceType,
    err_msg: errorMessage,
  });

  requireSupabaseOk(result, `Failed to mark ${resourceType} sync as failed`);
}

export async function syncAllResources(
  tenantId: string,
  hubspotClient: Client,
  resourceTypes?: ResourceType[]
): Promise<ResourceSyncResult[]> {
  const typesToSync = resourceTypes ?? (Object.keys(RESOURCE_EXTRACTORS) as ResourceType[]);
  const results: ResourceSyncResult[] = [];

  for (const resourceType of typesToSync) {
    try {
      const syncingResult = await supabaseAdmin
        .from('sync_status')
        .upsert(
          {
            tenant_id: tenantId,
            resource_type: resourceType,
            status: 'syncing',
            error_message: null,
          },
          { onConflict: 'tenant_id,resource_type' }
        );

      requireSupabaseOk(syncingResult, `Failed to mark ${resourceType} sync as in progress`);

      const data = await RESOURCE_EXTRACTORS[resourceType](hubspotClient);
      const itemsCount = countItems(data);

      const snapshotResult = await supabaseAdmin.from('portal_snapshots').insert({
        tenant_id: tenantId,
        resource_type: resourceType,
        snapshot_data: data,
      });

      requireSupabaseOk(snapshotResult, `Failed to store ${resourceType} snapshot`);

      results.push({ resourceType, data, itemsCount, success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await markSyncFailed(tenantId, resourceType, errorMessage);

      results.push({
        resourceType,
        data: null,
        itemsCount: 0,
        success: false,
        error: errorMessage,
      });
    }
  }

  return results;
}
