import Link from 'next/link';
import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';
import { SyncButton } from './sync-button';
import { ServiceKeyForm } from './service-key-form';

export const dynamic = 'force-dynamic';

interface TenantRow {
  id: string;
  name: string;
  hubspot_portal_id: string;
  hubspot_token_expires_at: string | null;
  auth_type: 'oauth' | 'service_key';
}

async function getTenants(): Promise<TenantRow[]> {
  return requireSupabaseData(
    await supabaseAdmin
    .from('tenants')
    .select('id, name, hubspot_portal_id, hubspot_token_expires_at, auth_type')
    .neq('id', 'shared')
    .order('created_at', { ascending: false }),
    'Failed to load tenants'
  ) ?? [];
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const tenants = await getTenants();

  return (
    <div className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-bold mt-2">Settings</h1>
        </div>
      </header>

      {params.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          Error: {params.error}
        </div>
      )}
      {params.connected && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          Successfully connected tenant: {params.connected}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Connect a HubSpot portal</h2>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <a
              href="/api/oauth/authorize"
              className="inline-block px-4 py-2 bg-black text-white rounded"
            >
              Connect via OAuth
            </a>
            <ServiceKeyForm />
          </div>
          <p className="text-sm text-gray-500">
            OAuth is recommended for long-term clients (auto-refreshing tokens).
            Service Keys are ideal for one-off audits — the client creates a key in
            HubSpot and pastes it to you.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Connected portals</h2>

        {tenants.length === 0 ? (
          <p className="text-gray-600">No portals connected.</p>
        ) : (
          <div className="grid gap-4">
            {tenants.map((tenant) => (
              <div key={tenant.id} id={tenant.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{tenant.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          tenant.auth_type === 'service_key'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {tenant.auth_type === 'service_key' ? 'Service Key' : 'OAuth'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Portal ID: {tenant.hubspot_portal_id} · Tenant: {tenant.id}
                    </p>
                    {tenant.hubspot_token_expires_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Token expires: {new Date(tenant.hubspot_token_expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <SyncButton tenantId={tenant.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
