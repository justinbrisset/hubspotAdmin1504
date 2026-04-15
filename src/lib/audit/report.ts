import { getTenantOrThrow } from '@/lib/portals/queries';
import { getLatestSnapshotsByResource } from '@/lib/snapshots/queries';
import { listSyncStatuses } from '@/lib/sync/queries';
import { requireSupabaseData, requireSupabaseOk, supabaseAdmin } from '@/lib/supabase-admin';
import type { AuditReport } from '@/types';
import { runAuditRules } from './rules';

function calculateAuditScore(report: AuditReport): number {
  const critical = report.summary.critical * 15;
  const warning = report.summary.warning * 5;
  const info = report.summary.info;

  return Math.max(0, 100 - critical - warning - info);
}

function serializeAuditReport(report: AuditReport) {
  return {
    tenantId: report.tenantId,
    tenantName: report.tenantName,
    generatedAt: report.generatedAt.toISOString(),
    overallScore: report.overallScore,
    summary: report.summary,
    findings: report.findings,
  };
}

export async function getLatestPersistedAuditScore(
  tenantId: string
): Promise<number | null> {
  const auditEntry = requireSupabaseData(
    await supabaseAdmin
      .from('audit_log')
      .select('after_state')
      .eq('tenant_id', tenantId)
      .eq('action', 'audit_report')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    `Failed to load persisted audit score for tenant "${tenantId}"`
  );

  const score = auditEntry?.after_state?.overallScore;
  return typeof score === 'number' ? score : null;
}

export async function persistAuditReport(report: AuditReport): Promise<number | null> {
  const previousScore = await getLatestPersistedAuditScore(report.tenantId);

  const insertResult = await supabaseAdmin.from('audit_log').insert({
    tenant_id: report.tenantId,
    action: 'audit_report',
    resource_type: 'audit_report',
    resource_id: `${report.tenantId}:${report.generatedAt.toISOString()}`,
    after_state: serializeAuditReport(report),
    proposal: previousScore !== null ? { previousScore } : null,
    reversible: false,
    executed_by: 'audit_engine',
  });

  requireSupabaseOk(insertResult, `Failed to persist audit report for tenant "${report.tenantId}"`);
  return previousScore;
}

export async function generateAuditReport(
  tenantId: string,
  options?: { persist?: boolean }
): Promise<AuditReport> {
  const [tenant, syncStatuses, latestSnapshots] = await Promise.all([
    getTenantOrThrow(tenantId),
    listSyncStatuses(tenantId),
    getLatestSnapshotsByResource(tenantId),
  ]);

  const findings = runAuditRules({
    tenant,
    syncStatuses,
    latestSnapshots,
  });

  const report: AuditReport = {
    tenantId,
    tenantName: tenant.name,
    generatedAt: new Date(),
    overallScore: 0,
    findings,
    summary: {
      critical: findings.filter((finding) => finding.severity === 'critical').length,
      warning: findings.filter((finding) => finding.severity === 'warning').length,
      info: findings.filter((finding) => finding.severity === 'info').length,
      totalResources: Object.keys(latestSnapshots).length,
    },
  };

  report.overallScore = calculateAuditScore(report);

  if (options?.persist) {
    await persistAuditReport(report);
  }

  return report;
}
