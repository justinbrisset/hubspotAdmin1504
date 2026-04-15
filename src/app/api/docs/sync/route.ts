import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/auth/cron-auth';
import { ingestHubSpotDocs } from '@/lib/snapshot/docs-ingest';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const cronDenied = verifyCronRequest(req);
  if (cronDenied) return cronDenied;

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
