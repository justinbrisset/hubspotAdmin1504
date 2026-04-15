import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';
import { getLatestChangesByResource, listRecentPortalChanges } from '@/lib/snapshots/queries';
import { listSyncStatuses, summarizeSyncStatuses } from '@/lib/sync/queries';
import { getLatestSnapshotsByResource } from '@/lib/snapshots/queries';
import type { PortalOverview, ResourceType, Tenant } from '@/types';

interface TenantRow {
  id: string;
  name: string;
  hubspot_portal_id: string;
  auth_type: 'oauth' | 'service_key';
  hubspot_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    name: row.name,
    hubspotPortalId: row.hubspot_portal_id,
    authType: row.auth_type,
    hubspotTokenExpiresAt: row.hubspot_token_expires_at
      ? new Date(row.hubspot_token_expires_at)
      : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function listTenants(): Promise<Tenant[]> {
  const rows = requireSupabaseData(
    await supabaseAdmin
      .from('tenants')
      .select(
        'id, name, hubspot_portal_id, auth_type, hubspot_token_expires_at, created_at, updated_at'
      )
      .neq('id', 'shared')
      .order('created_at', { ascending: false }),
    'Failed to load tenants'
  ) ?? [];

  return rows.map(mapTenant);
}

export async function getTenantOrThrow(tenantId: string): Promise<Tenant> {
  const row = requireSupabaseData(
    await supabaseAdmin
      .from('tenants')
      .select(
        'id, name, hubspot_portal_id, auth_type, hubspot_token_expires_at, created_at, updated_at'
      )
      .eq('id', tenantId)
      .neq('id', 'shared')
      .maybeSingle(),
    `Failed to load tenant "${tenantId}"`
  );

  if (!row) {
    throw new Error(`Tenant "${tenantId}" not found`);
  }

  return mapTenant(row);
}

export async function getPortalOverview(tenantId: string): Promise<PortalOverview> {
  const [tenant, syncStatuses, latestSnapshots, latestChanges, recentChanges] = await Promise.all([
    getTenantOrThrow(tenantId),
    listSyncStatuses(tenantId),
    getLatestSnapshotsByResource(tenantId),
    getLatestChangesByResource(tenantId),
    listRecentPortalChanges(tenantId, 12),
  ]);

  return {
    tenant,
    syncStatuses,
    syncSummary: summarizeSyncStatuses(syncStatuses),
    latestSnapshots,
    latestChanges,
    recentChanges,
  };
}

export async function listDashboardPortals(): Promise<
  Array<{
    tenant: Tenant;
    syncSummary: ReturnType<typeof summarizeSyncStatuses>;
    latestChangeResources: ResourceType[];
  }>
> {
  const [tenants, syncStatuses] = await Promise.all([listTenants(), listSyncStatuses()]);

  const statusesByTenant = new Map<string, typeof syncStatuses>();
  for (const syncStatus of syncStatuses) {
    const list = statusesByTenant.get(syncStatus.tenantId) ?? [];
    list.push(syncStatus);
    statusesByTenant.set(syncStatus.tenantId, list);
  }

  const changesByTenant = new Map<string, ResourceType[]>();
  const tenantChanges = requireSupabaseData(
    await supabaseAdmin
      .from('portal_changes')
      .select('tenant_id, resource_type')
      .order('created_at', { ascending: false })
      .limit(100),
    'Failed to load latest portal changes'
  ) ?? [];

  for (const change of tenantChanges) {
    const list = changesByTenant.get(change.tenant_id) ?? [];
    if (!list.includes(change.resource_type as ResourceType)) {
      list.push(change.resource_type as ResourceType);
    }
    changesByTenant.set(change.tenant_id, list.slice(0, 3));
  }

  return tenants.map((tenant) => ({
    tenant,
    syncSummary: summarizeSyncStatuses(statusesByTenant.get(tenant.id) ?? []),
    latestChangeResources: changesByTenant.get(tenant.id) ?? [],
  }));
}
