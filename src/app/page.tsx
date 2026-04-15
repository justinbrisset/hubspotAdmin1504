import Link from 'next/link';
import { PortalSummaryCard } from '@/components/portals/portal-summary-card';
import { AppShell } from '@/components/ui/app-shell';
import { Panel } from '@/components/ui/panel';
import { listDashboardPortals } from '@/lib/portals/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const portals = await listDashboardPortals();

  return (
    <AppShell
      title="HubSpot Copilot"
      eyebrow="Overview"
      description="A unified workspace for syncing, auditing, searching, and reviewing client HubSpot portals."
      actions={
        <Link
          href="/settings"
          className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12"
        >
          Connect portal
        </Link>
      }
    >
      {portals.length === 0 ? (
        <Panel className="p-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">Ready to onboard</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">No client portals yet</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            Start with OAuth for long-lived client access or use a service key for a fast one-off audit.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/settings"
              className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
            >
              Open settings
            </Link>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5">
          {portals.map((portal) => (
            <PortalSummaryCard
              key={portal.tenant.id}
              tenant={portal.tenant}
              syncSummary={portal.syncSummary}
              latestChangeResources={portal.latestChangeResources}
              href={`/portals/${portal.tenant.id}`}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
