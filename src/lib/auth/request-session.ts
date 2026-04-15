import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

export async function isRequestAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

/** Defense in depth alongside middleware — returns 401 response or null if OK. */
export async function requireSession(request: NextRequest): Promise<NextResponse | null> {
  if (!(await isRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
