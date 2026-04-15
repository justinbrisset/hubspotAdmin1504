import { requireSupabaseData, requireSupabaseOk, supabaseAdmin } from '@/lib/supabase-admin';
import type { ChangeProposal, ProposalSource, ProposalStatus, StoredChangeProposal } from '@/types';

interface ChangeProposalRow {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  title: string;
  summary: string | null;
  status: ProposalStatus;
  source: ProposalSource;
  risk_level: StoredChangeProposal['riskLevel'];
  confidence_score: number;
  reasoning: string;
  changes: StoredChangeProposal['changes'];
  doubts: string[] | null;
  alternative_approaches: StoredChangeProposal['alternativeApproaches'] | null;
  approved_at: string | null;
  applied_at: string | null;
  rejected_at: string | null;
  rolled_back_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

function mapProposal(row: ChangeProposalRow): StoredChangeProposal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    conversationId: row.conversation_id,
    title: row.title,
    summary: row.summary ?? undefined,
    status: row.status,
    source: row.source,
    riskLevel: row.risk_level,
    confidenceScore: row.confidence_score,
    reasoning: row.reasoning,
    changes: row.changes,
    doubts: row.doubts ?? undefined,
    alternativeApproaches: row.alternative_approaches ?? undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at) : null,
    appliedAt: row.applied_at ? new Date(row.applied_at) : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
    rolledBackAt: row.rolled_back_at ? new Date(row.rolled_back_at) : null,
    approvedBy: row.approved_by,
    rejectedReason: row.rejected_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function listChangeProposals(tenantId: string): Promise<StoredChangeProposal[]> {
  const rows = requireSupabaseData(
    await supabaseAdmin
      .from('change_proposals')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    `Failed to load change proposals for tenant "${tenantId}"`
  ) ?? [];

  return (rows as ChangeProposalRow[]).map(mapProposal);
}

export async function getChangeProposalOrThrow(
  proposalId: string
): Promise<StoredChangeProposal> {
  const row = requireSupabaseData(
    await supabaseAdmin
      .from('change_proposals')
      .select('*')
      .eq('id', proposalId)
      .maybeSingle(),
    `Failed to load change proposal "${proposalId}"`
  );

  if (!row) {
    throw new Error(`Change proposal "${proposalId}" not found`);
  }

  return mapProposal(row as ChangeProposalRow);
}

export async function insertGeneratedProposals({
  tenantId,
  proposals,
  source = 'audit',
  conversationId,
}: {
  tenantId: string;
  proposals: ChangeProposal[];
  source?: ProposalSource;
  conversationId?: string | null;
}): Promise<StoredChangeProposal[]> {
  if (proposals.length === 0) return [];

  const now = new Date().toISOString();
  const rows = proposals.map((proposal) => ({
    id: proposal.id,
    tenant_id: tenantId,
    conversation_id: conversationId ?? null,
    title: proposal.title ?? 'Untitled proposal',
    summary: proposal.summary ?? null,
    status: 'draft',
    source,
    risk_level: proposal.riskLevel,
    confidence_score: proposal.confidenceScore,
    reasoning: proposal.reasoning,
    changes: proposal.changes,
    doubts: proposal.doubts ?? null,
    alternative_approaches: proposal.alternativeApproaches ?? null,
    created_at: now,
    updated_at: now,
  }));

  const inserted = requireSupabaseData(
    await supabaseAdmin.from('change_proposals').insert(rows).select('*'),
    `Failed to store generated proposals for tenant "${tenantId}"`
  ) ?? [];

  return (inserted as ChangeProposalRow[]).map(mapProposal);
}

export async function updateChangeProposalStatus({
  proposalId,
  status,
  approvedBy,
  rejectedReason,
}: {
  proposalId: string;
  status: ProposalStatus;
  approvedBy?: string | null;
  rejectedReason?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === 'approved') {
    patch.approved_at = now;
    patch.approved_by = approvedBy ?? 'operator';
  }

  if (status === 'applied') {
    patch.applied_at = now;
  }

  if (status === 'rejected') {
    patch.rejected_at = now;
    patch.rejected_reason = rejectedReason ?? 'Rejected by operator';
  }

  if (status === 'rolled_back') {
    patch.rolled_back_at = now;
  }

  const result = await supabaseAdmin
    .from('change_proposals')
    .update(patch)
    .eq('id', proposalId);

  requireSupabaseOk(result, `Failed to update change proposal "${proposalId}"`);
}
