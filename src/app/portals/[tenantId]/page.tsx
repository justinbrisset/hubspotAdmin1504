import { SyncButton } from '@/app/settings/sync-button';
import { ChangeFeed } from '@/components/portals/change-feed';
import { ResourceStatusCard } from '@/components/portals/resource-status-card';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { getPortalOverview } from '@/lib/portals/queries';
import { getFailedResourceTypes } from '@/lib/sync/queries';
import type { ResourceType } from '@/types';

export const dynamic = 'force-dynamic';

const RESOURCE_ORDER: ResourceType[] = [
  'workflows',
  'properties',
  'pipelines',
  'forms',
  'lists',
  'marketing_emails',
  'owners',
];

function formatDate(value: Date | null): string {
  if (!value) return 'Not synced yet';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export default async function PortalDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const overview = await getPortalOverview(tenantId);
  const failedResourceTypes = getFailedResourceTypes(overview.syncStatuses);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel className="p-6">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Live posture</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-4xl font-semibold text-white">{overview.syncSummary.completed}</p>
              <p className="mt-2 text-sm text-white/55">healthy sync lanes</p>
            </div>
            <div>
              <p className="text-4xl font-semibold text-white">{overview.syncSummary.totalItems}</p>
              <p className="mt-2 text-sm text-white/55">records in the current sync footprint</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {formatDate(overview.syncSummary.latestSyncAt)}
              </p>
              <p className="mt-2 text-sm text-white/55">last successful activity mark</p>
            </div>
          </div>

          {failedResourceTypes.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <SyncButton
                tenantId={tenantId}
                resourceTypes={failedResourceTypes}
                label="Retry failed lanes"
              />
            </div>
          ) : null}
        </Panel>

        <Panel className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Current risks</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Sync attention board</h2>
            </div>
            <StatusPill tone={overview.syncSummary.errored > 0 ? 'danger' : 'success'}>
              {overview.syncSummary.errored > 0 ? 'Needs review' : 'Clear'}
            </StatusPill>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Errors</p>
              <p className="mt-2 text-3xl font-semibold text-white">{overview.syncSummary.errored}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Syncing</p>
              <p className="mt-2 text-3xl font-semibold text-white">{overview.syncSummary.syncing}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Diff feed</p>
              <p className="mt-2 text-3xl font-semibold text-white">{overview.recentChanges.length}</p>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {RESOURCE_ORDER.map((resourceType) => (
          <ResourceStatusCard
            key={resourceType}
            resourceType={resourceType}
            status={overview.syncStatuses.find((status) => status.resourceType === resourceType)}
            change={overview.latestChanges[resourceType]}
          />
        ))}
      </section>

      <ChangeFeed changes={overview.recentChanges} />
    </div>
  );
}
