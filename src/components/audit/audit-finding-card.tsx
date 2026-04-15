import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import type { AuditFinding } from '@/types';

function getTone(severity: AuditFinding['severity']) {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'warning':
      return 'warning';
    default:
      return 'accent';
  }
}

export function AuditFindingCard({ finding }: { finding: AuditFinding }) {
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{finding.category}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{finding.title}</h3>
        </div>
        <StatusPill tone={getTone(finding.severity)}>{finding.severity}</StatusPill>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/65">{finding.description}</p>

      <div className="mt-5 rounded-2xl border border-white/8 bg-slate-950/25 p-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Recommendation</p>
        <p className="mt-2 text-sm leading-6 text-white/70">{finding.recommendation}</p>
      </div>

      {finding.affectedResources.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {finding.affectedResources.map((resource) => (
            <StatusPill key={`${finding.id}-${resource.id}`} tone="neutral">
              {resource.name}
            </StatusPill>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
