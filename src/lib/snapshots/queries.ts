import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';
import type {
  PortalChange,
  PortalChangeSummary,
  PortalSnapshot,
  ResourceType,
} from '@/types';

interface PortalSnapshotRow {
  id: string;
  tenant_id: string;
  resource_type: string;
  snapshot_data: unknown;
  created_at: string;
}

interface PortalChangeRow {
  id: string;
  tenant_id: string;
  resource_type: string;
  snapshot_id: string;
  previous_snapshot_id: string | null;
  summary: PortalChangeSummary;
  created_at: string;
}

function mapPortalSnapshot(row: PortalSnapshotRow): PortalSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    resourceType: row.resource_type as ResourceType,
    snapshotData: row.snapshot_data,
    createdAt: new Date(row.created_at),
  };
}

function mapPortalChange(row: PortalChangeRow): PortalChange {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    resourceType: row.resource_type as ResourceType,
    snapshotId: row.snapshot_id,
    previousSnapshotId: row.previous_snapshot_id,
    summary: row.summary,
    createdAt: new Date(row.created_at),
  };
}

export async function listRecentSnapshots(
  tenantId: string,
  limit = 24
): Promise<PortalSnapshot[]> {
  const rows = requireSupabaseData(
    await supabaseAdmin
      .from('portal_snapshots')
      .select('id, tenant_id, resource_type, snapshot_data, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit),
    `Failed to load snapshots for tenant "${tenantId}"`
  ) ?? [];

  return rows.map(mapPortalSnapshot);
}

export async function getLatestSnapshotsByResource(
  tenantId: string
): Promise<Partial<Record<ResourceType, PortalSnapshot>>> {
  const snapshots = await listRecentSnapshots(tenantId, 100);
  const latestSnapshots: Partial<Record<ResourceType, PortalSnapshot>> = {};

  for (const snapshot of snapshots) {
    if (!latestSnapshots[snapshot.resourceType]) {
      latestSnapshots[snapshot.resourceType] = snapshot;
    }
  }

  return latestSnapshots;
}

export async function listRecentPortalChanges(
  tenantId: string,
  limit = 24
): Promise<PortalChange[]> {
  const rows = requireSupabaseData(
    await supabaseAdmin
      .from('portal_changes')
      .select('id, tenant_id, resource_type, snapshot_id, previous_snapshot_id, summary, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit),
    `Failed to load portal changes for tenant "${tenantId}"`
  ) ?? [];

  return rows.map(mapPortalChange);
}

export async function getLatestChangesByResource(
  tenantId: string
): Promise<Partial<Record<ResourceType, PortalChange>>> {
  const changes = await listRecentPortalChanges(tenantId, 100);
  const latestChanges: Partial<Record<ResourceType, PortalChange>> = {};

  for (const change of changes) {
    if (!latestChanges[change.resourceType]) {
      latestChanges[change.resourceType] = change;
    }
  }

  return latestChanges;
}
