import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import type { PortalChange } from '@/types';

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export function ChangeFeed({ changes }: { changes: PortalChange[] }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Recent activity</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Snapshot change feed</h3>
        </div>
        <StatusPill tone="accent">{changes.length} entries</StatusPill>
      </div>

      {changes.length === 0 ? (
        <p className="mt-5 text-sm text-white/55">
          No change feed yet. Run an additional sync to compare snapshots and surface meaningful deltas.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {changes.map((change) => (
            <div
              key={change.id}
              className="rounded-2xl border border-white/8 bg-slate-950/25 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium capitalize text-white">{change.resourceType.replace('_', ' ')}</p>
                  <p className="mt-1 text-white/45">{formatDate(change.createdAt)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={change.summary.added.count > 0 ? 'accent' : 'neutral'}>
                    {change.summary.added.count} added
                  </StatusPill>
                  <StatusPill tone={change.summary.updated.count > 0 ? 'warning' : 'neutral'}>
                    {change.summary.updated.count} updated
                  </StatusPill>
                  <StatusPill tone={change.summary.removed.count > 0 ? 'danger' : 'neutral'}>
                    {change.summary.removed.count} removed
                  </StatusPill>
                </div>
              </div>

              {change.summary.added.samples.length > 0 ? (
                <p className="mt-3 text-white/60">
                  New items: {change.summary.added.samples.map((sample) => sample.name).join(', ')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
