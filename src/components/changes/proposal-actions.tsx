'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProposalStatus } from '@/types';

export function ProposalActions({
  proposalId,
  status,
  canAutoApply,
}: {
  proposalId: string;
  status: ProposalStatus;
  canAutoApply: boolean;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: 'approve' | 'reject' | 'apply' | 'rollback') {
    setLoadingAction(action);
    setError(null);

    const rejectedReason =
      action === 'reject' ? window.prompt('Optional rejection reason', 'Needs manual review') ?? undefined : undefined;

    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(rejectedReason ? { rejectedReason } : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Request failed');
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === 'draft' ? (
          <>
            <button
              type="button"
              onClick={() => runAction('approve')}
              disabled={Boolean(loadingAction)}
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12 disabled:opacity-50"
            >
              {loadingAction === 'approve' ? 'Approving...' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => runAction('reject')}
              disabled={Boolean(loadingAction)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white disabled:opacity-50"
            >
              {loadingAction === 'reject' ? 'Rejecting...' : 'Reject'}
            </button>
          </>
        ) : null}

        {status === 'approved' && canAutoApply ? (
          <button
            type="button"
            onClick={() => runAction('apply')}
            disabled={Boolean(loadingAction)}
            className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/12 disabled:opacity-50"
          >
            {loadingAction === 'apply' ? 'Applying...' : 'Apply to HubSpot'}
          </button>
        ) : null}

        {status === 'applied' ? (
          <button
            type="button"
            onClick={() => runAction('rollback')}
            disabled={Boolean(loadingAction)}
            className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-300/40 hover:bg-amber-300/12 disabled:opacity-50"
          >
            {loadingAction === 'rollback' ? 'Rolling back...' : 'Roll back'}
          </button>
        ) : null}
      </div>

      {status === 'approved' && !canAutoApply ? (
        <p className="text-sm text-white/55">
          This recommendation is review-only and needs to be applied manually in HubSpot.
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
