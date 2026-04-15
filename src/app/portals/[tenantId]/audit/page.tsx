import Link from 'next/link';
import { AuditFindingCard } from '@/components/audit/audit-finding-card';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/status-pill';
import { generateAuditReport } from '@/lib/audit/report';

export const dynamic = 'force-dynamic';

export default async function PortalAuditPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const report = await generateAuditReport(tenantId);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-6">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Audit score</p>
          <div className="mt-5 flex items-end gap-4">
            <p className="text-6xl font-semibold text-white">{report.overallScore}</p>
            <p className="pb-2 text-sm text-white/55">out of 100</p>
          </div>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/60">
            This score is deterministic: critical findings cost 15 points, warnings 5, and informational issues 1.
          </p>
        </Panel>

        <Panel className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Report summary</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Priorities to review</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/api/audit/${tenantId}`}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white"
              >
                View JSON
              </Link>
              <Link
                href={`/api/audit/${tenantId}/report`}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12"
              >
                Open printable report
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Critical</p>
              <p className="mt-2 text-3xl font-semibold text-white">{report.summary.critical}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Warning</p>
              <p className="mt-2 text-3xl font-semibold text-white">{report.summary.warning}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Info</p>
              <p className="mt-2 text-3xl font-semibold text-white">{report.summary.info}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/25 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Resources</p>
              <p className="mt-2 text-3xl font-semibold text-white">{report.summary.totalResources}</p>
            </div>
          </div>
        </Panel>
      </section>

      {report.findings.length === 0 ? (
        <Panel className="p-8 text-center">
          <StatusPill tone="success">Clear</StatusPill>
          <h2 className="mt-4 text-2xl font-semibold text-white">No findings in the current baseline</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/60">
            The latest synced portal data did not trigger any deterministic audit rules.
          </p>
        </Panel>
      ) : (
        <section className="grid gap-4">
          {report.findings
            .slice()
            .sort((left, right) => {
              const order = { critical: 0, warning: 1, info: 2 };
              return order[left.severity] - order[right.severity];
            })
            .map((finding) => (
              <AuditFindingCard key={finding.id} finding={finding} />
            ))}
        </section>
      )}
    </div>
  );
}
