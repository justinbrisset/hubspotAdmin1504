import { NextRequest, NextResponse } from 'next/server';
import { ingestHubSpotDocs } from '@/lib/snapshot/docs-ingest';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Verify cron secret for automated triggers
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await ingestHubSpotDocs();

    if (!result.updated) {
      return NextResponse.json({ message: 'Docs unchanged, skipping re-embed' });
    }

    return NextResponse.json({
      message: 'Docs updated and embedded',
      chunkCount: result.chunkCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
