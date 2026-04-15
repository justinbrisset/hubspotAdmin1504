import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Validates cron/manual triggers using CRON_SECRET.
 * Production: secret must be set and Authorization must match.
 * Development: if unset, allows local runs; if set, header must match.
 */
export function verifyCronRequest(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
