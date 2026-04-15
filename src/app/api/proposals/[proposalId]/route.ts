import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/request-session';
import { applyHubSpotChange, rollbackHubSpotChange } from '@/lib/hubspot/actions';
import { sendOpsNotification } from '@/lib/notifications/webhook';
import { requireSupabaseOk, supabaseAdmin } from '@/lib/supabase-admin';
import {
  getChangeProposalOrThrow,
  updateChangeProposalStatus,
} from '@/lib/proposals/store';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'apply', 'rollback']),
  rejectedReason: z.string().min(3).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const parsed = actionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { proposalId } = await params;

  try {
    const proposal = await getChangeProposalOrThrow(proposalId);

    switch (parsed.data.action) {
      case 'approve': {
        await updateChangeProposalStatus({
          proposalId,
          status: 'approved',
          approvedBy: 'operator',
        });
        break;
      }

      case 'reject': {
        await updateChangeProposalStatus({
          proposalId,
          status: 'rejected',
          rejectedReason: parsed.data.rejectedReason,
        });
        break;
      }

      case 'apply': {
        if (proposal.status !== 'approved') {
          return NextResponse.json(
            { error: 'Proposal must be approved before it can be applied.' },
            { status: 409 }
          );
        }

        for (const change of proposal.changes) {
          const result = await applyHubSpotChange(proposal.tenantId, change);
          const auditResult = await supabaseAdmin.from('audit_log').insert({
            tenant_id: proposal.tenantId,
            conversation_id: proposal.conversationId ?? null,
            action: 'proposal_apply',
            resource_type: result.resourceType,
            resource_id: result.resourceId,
            before_state: result.beforeState,
            after_state: result.afterState,
            proposal,
            reversible: change.reversible,
            executed_by: 'operator',
          });

          requireSupabaseOk(auditResult, `Failed to log applied proposal "${proposalId}"`);
        }

        await updateChangeProposalStatus({
          proposalId,
          status: 'applied',
        });

        await sendOpsNotification({
          title: `Applied proposal for ${proposal.tenantId}`,
          body: `${proposal.title ?? 'Untitled proposal'} was applied to HubSpot.`,
          severity: 'info',
          details: {
            proposalId,
            tenantId: proposal.tenantId,
            changes: proposal.changes,
          },
        });
        break;
      }

      case 'rollback': {
        if (proposal.status !== 'applied') {
          return NextResponse.json(
            { error: 'Only applied proposals can be rolled back.' },
            { status: 409 }
          );
        }

        for (const change of proposal.changes) {
          const result = await rollbackHubSpotChange(proposal.tenantId, change);
          const auditResult = await supabaseAdmin.from('audit_log').insert({
            tenant_id: proposal.tenantId,
            conversation_id: proposal.conversationId ?? null,
            action: 'proposal_rollback',
            resource_type: result.resourceType,
            resource_id: result.resourceId,
            before_state: result.beforeState,
            after_state: result.afterState,
            proposal,
            reversible: true,
            executed_by: 'operator',
          });

          requireSupabaseOk(auditResult, `Failed to log rollback for proposal "${proposalId}"`);
        }

        await updateChangeProposalStatus({
          proposalId,
          status: 'rolled_back',
        });
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
