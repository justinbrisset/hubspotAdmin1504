import Link from 'next/link';
import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface TenantRow {
  id: string;
  name: string;
  hubspot_portal_id: string;
  created_at: string;
}

interface SyncStatusRow {
  tenant_id: string;
  resource_type: string;
  status: string;
  items_count: number;
  last_synced: string | null;
}

async function getTenants(): Promise<TenantRow[]> {
  return requireSupabaseData(
    await supabaseAdmin
    .from('tenants')
    .select('id, name, hubspot_portal_id, created_at')
    .neq('id', 'shared')
    .order('created_at', { ascending: false }),
    'Failed to load tenants'
  ) ?? [];
}

async function getSyncStatuses(): Promise<SyncStatusRow[]> {
  return requireSupabaseData(
    await supabaseAdmin
    .from('sync_status')
    .select('tenant_id, resource_type, status, items_count, last_synced'),
    'Failed to load sync status'
  ) ?? [];
}

export default async function DashboardPage() {
  const [tenants, syncStatuses] = await Promise.all([getTenants(), getSyncStatuses()]);

  const statusByTenant = new Map<string, SyncStatusRow[]>();
  for (const s of syncStatuses) {
    const list = statusByTenant.get(s.tenant_id) ?? [];
    list.push(s);
    statusByTenant.set(s.tenant_id, list);
  }

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">HubSpot Copilot</h1>
        <Link
          href="/settings"
          className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Settings
        </Link>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">Clients</h2>

        {tenants.length === 0 ? (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">No clients connected yet.</p>
            <Link
              href="/api/oauth/authorize"
              className="inline-block px-4 py-2 bg-black text-white rounded"
            >
              Connect your first HubSpot portal
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {tenants.map((tenant) => {
              const statuses = statusByTenant.get(tenant.id) ?? [];
              const completed = statuses.filter((s) => s.status === 'completed').length;
              const errored = statuses.filter((s) => s.status === 'error').length;
              const totalItems = statuses.reduce((sum, s) => sum + (s.items_count ?? 0), 0);

              return (
                <div key={tenant.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{tenant.name}</h3>
                      <p className="text-sm text-gray-500">
                        Portal ID: {tenant.hubspot_portal_id} · {tenant.id}
                      </p>
                    </div>
                    <Link
                      href={`/settings#${tenant.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </div>
                  <div className="text-sm text-gray-600 mt-3">
                    {statuses.length === 0 ? (
                      <span>Not synced yet</span>
                    ) : (
                      <span>
                        {completed} synced · {errored} errors · {totalItems} items
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
