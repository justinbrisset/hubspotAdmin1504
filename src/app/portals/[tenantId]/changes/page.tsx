import { GenerateRecommendationsButton } from '@/components/changes/generate-recommendations-button';
import { ProposalCard } from '@/components/changes/proposal-card';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { listChangeProposals } from '@/lib/proposals/store';

export const dynamic = 'force-dynamic';

export default async function PortalChangesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const proposals = await listChangeProposals(tenantId);

  const draftCount = proposals.filter((proposal) => proposal.status === 'draft').length;
  const approvedCount = proposals.filter((proposal) => proposal.status === 'approved').length;
  const appliedCount = proposals.filter((proposal) => proposal.status === 'applied').length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="p-6">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Proposal flow</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Reviewable recommendations</h2>
          <p className="mt-4 max-w-2xl text-white/60">
            Generate deterministic recommendations from the latest audit signals, approve the ones you trust, then auto-apply the low-risk property documentation fixes.
          </p>
          <div className="mt-6">
            <GenerateRecommendationsButton tenantId={tenantId} />
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="flex flex-wrap gap-3">
            <StatusPill tone="neutral">{draftCount} draft</StatusPill>
            <StatusPill tone="accent">{approvedCount} approved</StatusPill>
            <StatusPill tone="success">{appliedCount} applied</StatusPill>
          </div>
          <p className="mt-5 text-sm leading-6 text-white/60">
            Only property description updates are auto-applied in this first pass. Higher-risk changes stay review-only and include explicit manual instructions.
          </p>
        </Panel>
      </section>

      {proposals.length === 0 ? (
        <Panel className="p-8 text-center">
          <h3 className="text-2xl font-semibold text-white">No proposals yet</h3>
          <p className="mx-auto mt-3 max-w-xl text-white/60">
            Generate recommendations to turn audit signals into an approval queue.
          </p>
        </Panel>
      ) : (
        <section className="grid gap-4">
          {proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </section>
      )}
    </div>
  );
}
