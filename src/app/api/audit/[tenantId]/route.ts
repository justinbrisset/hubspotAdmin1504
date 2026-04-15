import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/request-session';
import { generateAuditReport, getLatestPersistedAuditScore } from '@/lib/audit/report';
import { sendOpsNotification } from '@/lib/notifications/webhook';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const { tenantId } = await params;
  const persist = req.nextUrl.searchParams.get('persist') === 'true';

  try {
    const previousScore = persist ? await getLatestPersistedAuditScore(tenantId) : null;
    const report = await generateAuditReport(tenantId, { persist });

    if (persist && previousScore !== null && report.overallScore < previousScore) {
      await sendOpsNotification({
        title: `Audit score regressed for ${report.tenantName}`,
        body: `The persisted audit score fell from ${previousScore} to ${report.overallScore}.`,
        severity: 'warning',
        details: {
          tenantId,
          previousScore,
          currentScore: report.overallScore,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
