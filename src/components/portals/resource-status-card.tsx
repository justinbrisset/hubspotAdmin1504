import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import type { PortalChange, ResourceType, SyncStatus } from '@/types';

const RESOURCE_LABELS: Record<ResourceType, string> = {
  workflows: 'Workflows',
  properties: 'Properties',
  pipelines: 'Pipelines',
  forms: 'Forms',
  lists: 'Lists',
  marketing_emails: 'Marketing Emails',
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

function getStatusTone(status: SyncStatus['status']) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'error':
      return 'danger';
    case 'syncing':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function ResourceStatusCard({
  resourceType,
  status,
  change,
}: {
  resourceType: ResourceType;
  status?: SyncStatus;
  change?: PortalChange;
}) {
  return (
    <Panel className="h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Resource lane</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{RESOURCE_LABELS[resourceType]}</h3>
        </div>

        <StatusPill tone={getStatusTone(status?.status ?? 'pending')}>
          {status?.status ?? 'pending'}
        </StatusPill>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Items</p>
          <p className="mt-2 text-2xl font-semibold text-white">{status?.itemsCount ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Last sync</p>
          <p className="mt-2 text-sm font-medium text-white/80">{formatDate(status?.lastSynced)}</p>
        </div>
      </div>

      {status?.errorMessage ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/8 p-3 text-sm text-rose-100">
          {status.errorMessage}
        </div>
      ) : null}

      {change ? (
        <div className="mt-5 space-y-3 rounded-2xl border border-white/8 bg-slate-950/30 p-4 text-sm text-white/65">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={change.summary.added.count > 0 ? 'accent' : 'neutral'}>
              +{change.summary.added.count} added
            </StatusPill>
            <StatusPill tone={change.summary.updated.count > 0 ? 'warning' : 'neutral'}>
              ~{change.summary.updated.count} updated
            </StatusPill>
            <StatusPill tone={change.summary.removed.count > 0 ? 'danger' : 'neutral'}>
              -{change.summary.removed.count} removed
            </StatusPill>
          </div>

          {change.summary.renamed.count > 0 ? (
            <p className="text-white/70">{change.summary.renamed.count} renamed since the prior snapshot.</p>
          ) : null}

          {change.summary.added.samples.length > 0 ? (
            <ul className="space-y-1">
              {change.summary.added.samples.slice(0, 3).map((sample) => (
                <li key={`${sample.id}-${sample.name}`} className="truncate text-white/55">
                  New: {sample.name}
                </li>
              ))}
            </ul>
          ) : (
            <p>No new sample items were captured in the latest diff.</p>
          )}
        </div>
      ) : (
        <p className="mt-5 text-sm text-white/50">
          No change summary yet. The first sync will establish a before/after baseline for this resource.
        </p>
      )}
    </Panel>
  );
}
