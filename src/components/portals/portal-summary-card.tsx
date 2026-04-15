import Link from 'next/link';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import type { ResourceType, SyncStatusSummary, Tenant } from '@/types';

const RESOURCE_LABELS: Record<ResourceType, string> = {
  workflows: 'Workflows',
  properties: 'Properties',
  pipelines: 'Pipelines',
  forms: 'Forms',
  lists: 'Lists',
  marketing_emails: 'Emails',
  owners: 'Owners',
};

function formatDate(value: Date | null | undefined): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export function PortalSummaryCard({
  tenant,
  syncSummary,
  href,
  latestChangeResources = [],
}: {
  tenant: Tenant;
  syncSummary: SyncStatusSummary;
  href: string;
  latestChangeResources?: ResourceType[];
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-white/8 bg-white/[0.03] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-white">{tenant.name}</h3>
              <StatusPill tone={tenant.authType === 'service_key' ? 'lavender' : 'accent'}>
                {tenant.authType === 'service_key' ? 'Service Key' : 'OAuth'}
              </StatusPill>
            </div>
            <p className="mt-2 text-sm text-white/55">
              Portal {tenant.hubspotPortalId} · Tenant {tenant.id}
            </p>
          </div>

          <Link
            href={href}
            className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12"
          >
            Open workspace
          </Link>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Resources</p>
            <p className="mt-2 text-3xl font-semibold text-white">{syncSummary.completed}</p>
            <p className="mt-1 text-sm text-white/55">completed sync lanes</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Items</p>
            <p className="mt-2 text-3xl font-semibold text-white">{syncSummary.totalItems}</p>
            <p className="mt-1 text-sm text-white/55">indexed across all resources</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Last sync</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatDate(syncSummary.latestSyncAt)}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {syncSummary.errored > 0
                ? `${syncSummary.errored} resource issues need review`
                : 'No active sync errors'}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-white/8 bg-slate-950/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Recent signal</p>
            <StatusPill tone={syncSummary.errored > 0 ? 'danger' : 'success'}>
              {syncSummary.errored > 0 ? 'Attention' : 'Healthy'}
            </StatusPill>
          </div>

          {latestChangeResources.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {latestChangeResources.map((resourceType) => (
                <StatusPill key={resourceType} tone="neutral">
                  {RESOURCE_LABELS[resourceType]}
                </StatusPill>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/55">
              No recent change summaries yet. Run a sync to establish the first baseline.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
