import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/request-session';
import { generateAuditReport, getLatestPersistedAuditScore } from '@/lib/audit/report';
import { sendOpsNotification } from '@/lib/notifications/webhook';

export const dynamic = 'force-dynamic';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const { tenantId } = await params;

  try {
    const previousScore = await getLatestPersistedAuditScore(tenantId);
    const report = await generateAuditReport(tenantId, { persist: true });

    if (previousScore !== null && report.overallScore < previousScore) {
      await sendOpsNotification({
        title: `Audit score regressed for ${report.tenantName}`,
        body: `The printable audit route recorded a score drop from ${previousScore} to ${report.overallScore}.`,
        severity: 'warning',
        details: {
          tenantId,
          previousScore,
          currentScore: report.overallScore,
        },
      });
    }

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.tenantName)} Audit Report</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
      main { max-width: 960px; margin: 0 auto; padding: 48px 24px 72px; }
      h1, h2, h3, p { margin: 0; }
      .hero, .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 24px; }
      .hero { margin-bottom: 24px; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 24px; }
      .metric { background: #f8fafc; border-radius: 18px; padding: 16px; }
      .findings { display: grid; gap: 16px; margin-top: 24px; }
      .pill { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: #0f172a; background: #e2e8f0; border-radius: 999px; padding: 6px 10px; }
      .critical { background: #fee2e2; color: #9f1239; }
      .warning { background: #fef3c7; color: #92400e; }
      .info { background: #dbeafe; color: #1d4ed8; }
      ul { padding-left: 20px; margin: 12px 0 0; }
      li { margin-top: 6px; }
      @media print {
        body { background: #fff; }
        main { padding: 0; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="pill">HubSpot Copilot</p>
        <h1 style="margin-top:16px;font-size:40px;">${escapeHtml(report.tenantName)} Audit Report</h1>
        <p style="margin-top:12px;color:#475569;line-height:1.7;">
          Generated ${escapeHtml(report.generatedAt.toLocaleString())}. This report summarizes deterministic findings from the latest synced portal snapshots.
        </p>

        <div class="grid">
          <div class="metric"><p style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">Score</p><p style="margin-top:10px;font-size:32px;font-weight:700;">${report.overallScore}</p></div>
          <div class="metric"><p style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">Critical</p><p style="margin-top:10px;font-size:32px;font-weight:700;">${report.summary.critical}</p></div>
          <div class="metric"><p style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">Warning</p><p style="margin-top:10px;font-size:32px;font-weight:700;">${report.summary.warning}</p></div>
          <div class="metric"><p style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">Info</p><p style="margin-top:10px;font-size:32px;font-weight:700;">${report.summary.info}</p></div>
        </div>
      </section>

      <section class="findings">
        ${report.findings
          .map(
            (finding) => `
              <article class="card">
                <span class="pill ${finding.severity}">${escapeHtml(finding.severity)}</span>
                <h2 style="margin-top:14px;font-size:24px;">${escapeHtml(finding.title)}</h2>
                <p style="margin-top:12px;color:#475569;line-height:1.7;">${escapeHtml(finding.description)}</p>
                <p style="margin-top:18px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.14em;">Recommendation</p>
                <p style="margin-top:8px;line-height:1.7;">${escapeHtml(finding.recommendation)}</p>
                ${
                  finding.affectedResources.length > 0
                    ? `<ul>${finding.affectedResources
                        .map((resource) => `<li>${escapeHtml(resource.name)} (${escapeHtml(resource.type)})</li>`)
                        .join('')}</ul>`
                    : ''
                }
              </article>
            `
          )
          .join('')}
      </section>
    </main>
  </body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
