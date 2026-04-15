import { ProposalActions } from '@/components/changes/proposal-actions';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import type { StoredChangeProposal } from '@/types';

function getStatusTone(status: StoredChangeProposal['status']) {
  switch (status) {
    case 'approved':
      return 'accent';
    case 'applied':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'rolled_back':
      return 'warning';
    default:
      return 'neutral';
  }
}

function getRiskTone(riskLevel: StoredChangeProposal['riskLevel']) {
  switch (riskLevel) {
    case 'high':
      return 'danger';
    case 'medium':
      return 'warning';
    default:
      return 'success';
  }
}

export function ProposalCard({ proposal }: { proposal: StoredChangeProposal }) {
  const canAutoApply = proposal.changes.every((change) => !change.requiresUI);

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">{proposal.source}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{proposal.title ?? 'Untitled proposal'}</h3>
          {proposal.summary ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">{proposal.summary}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill tone={getStatusTone(proposal.status)}>{proposal.status}</StatusPill>
          <StatusPill tone={getRiskTone(proposal.riskLevel)}>{proposal.riskLevel} risk</StatusPill>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Reasoning</p>
          <p className="mt-2 text-sm leading-6 text-white/70">{proposal.reasoning}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-white/40">
            Confidence {(proposal.confidenceScore * 100).toFixed(0)}%
          </p>
        </div>

        <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Proposed changes</p>
          <ul className="mt-3 space-y-3 text-sm text-white/70">
            {proposal.changes.map((change) => (
              <li key={`${proposal.id}-${change.resourceId ?? change.resourceName}`}>
                <p className="font-medium text-white">{change.resourceName}</p>
                <p className="mt-1 text-white/55">
                  {change.field ? `Update ${change.field}` : change.action} ·{' '}
                  {change.requiresUI ? 'manual review' : 'can be auto-applied'}
                </p>
                {change.uiInstructions ? (
                  <p className="mt-2 text-white/50">{change.uiInstructions}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5">
        <ProposalActions
          proposalId={proposal.id}
          status={proposal.status}
          canAutoApply={canAutoApply}
        />
      </div>
    </Panel>
  );
}
