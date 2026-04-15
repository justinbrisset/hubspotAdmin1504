import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';
import type { ResourceType, SyncStatus, SyncStatusSummary } from '@/types';

interface SyncStatusRow {
  id: string;
  tenant_id: string;
  resource_type: string;
  last_synced: string | null;
  status: SyncStatus['status'];
  error_message: string | null;
  items_count: number | null;
  retry_count: number | null;
}

function mapSyncStatus(row: SyncStatusRow): SyncStatus {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    resourceType: row.resource_type as ResourceType,
    lastSynced: row.last_synced ? new Date(row.last_synced) : null,
    status: row.status,
    errorMessage: row.error_message,
    itemsCount: row.items_count ?? 0,
    retryCount: row.retry_count ?? 0,
  };
}

export async function listSyncStatuses(tenantId?: string): Promise<SyncStatus[]> {
  let query = supabaseAdmin
    .from('sync_status')
    .select('id, tenant_id, resource_type, last_synced, status, error_message, items_count, retry_count')
    .order('resource_type');

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const rows = requireSupabaseData(await query, 'Failed to load sync statuses') ?? [];
  return rows.map(mapSyncStatus);
}

export function summarizeSyncStatuses(statuses: SyncStatus[]): SyncStatusSummary {
  return statuses.reduce<SyncStatusSummary>(
    (summary, status) => {
      if (status.status === 'completed') summary.completed += 1;
      if (status.status === 'error') summary.errored += 1;
      if (status.status === 'syncing') summary.syncing += 1;

      summary.totalItems += status.itemsCount;

      if (!summary.latestSyncAt) {
        summary.latestSyncAt = status.lastSynced;
      } else if (status.lastSynced && status.lastSynced > summary.latestSyncAt) {
        summary.latestSyncAt = status.lastSynced;
      }

      return summary;
    },
    {
      completed: 0,
      errored: 0,
      syncing: 0,
      totalItems: 0,
      latestSyncAt: null,
    }
  );
}

export function getFailedResourceTypes(statuses: SyncStatus[]): ResourceType[] {
  return statuses
    .filter((status) => status.status === 'error')
    .map((status) => status.resourceType);
}
