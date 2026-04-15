import Link from 'next/link';
import { AppShell } from '@/components/ui/app-shell';
import { Panel } from '@/components/ui/panel';
import { PortalSummaryCard } from '@/components/portals/portal-summary-card';
import { SyncButton } from './sync-button';
import { ServiceKeyForm } from './service-key-form';
import { listDashboardPortals } from '@/lib/portals/queries';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const portals = await listDashboardPortals();

  return (
    <AppShell
      title="Settings"
      eyebrow="Connections"
      description="Connect new portals, run manual syncs, and manage the authentication method used for each client workspace."
      actions={
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white"
        >
          Back to dashboard
        </Link>
      }
    >
      <div className="space-y-8">
        {params.error ? (
          <Panel className="border-rose-400/20 bg-rose-400/8 px-5 py-4 text-rose-100">
            Error: {params.error}
          </Panel>
        ) : null}

        {params.connected ? (
          <Panel className="border-emerald-400/20 bg-emerald-400/8 px-5 py-4 text-emerald-100">
            Successfully connected tenant: {params.connected}
          </Panel>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel className="p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Step 1</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Connect a new portal</h2>
            <p className="mt-4 max-w-xl text-white/60">
              OAuth is best when you own the long-term relationship and want token refresh handled automatically.
              Service keys are faster for one-off diagnostic passes and ad hoc audits.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/api/oauth/authorize"
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12"
              >
                Connect via OAuth
              </a>
              <ServiceKeyForm />
            </div>
          </Panel>

          <Panel className="p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Step 2</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Run a baseline sync</h2>
            <p className="mt-4 text-white/60">
              Once connected, open the portal workspace to establish snapshots, change history, and audit context. Every later feature depends on that first baseline.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/60">
              <li>Sync portal resources into append-only snapshots</li>
              <li>Generate a compact change summary against the prior baseline</li>
              <li>Seed the audit and chat layers with current portal context</li>
            </ul>
          </Panel>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Connected portals</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Current workspaces</h2>
          </div>

          {portals.length === 0 ? (
            <Panel className="p-8 text-center text-white/55">No portals connected yet.</Panel>
          ) : (
            <div className="grid gap-5">
              {portals.map((portal) => (
                <div key={portal.tenant.id} className="space-y-3" id={portal.tenant.id}>
                  <PortalSummaryCard
                    tenant={portal.tenant}
                    syncSummary={portal.syncSummary}
                    latestChangeResources={portal.latestChangeResources}
                    href={`/portals/${portal.tenant.id}`}
                  />
                  <div className="flex justify-end">
                    <SyncButton tenantId={portal.tenant.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
