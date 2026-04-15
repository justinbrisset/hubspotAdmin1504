import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/connect') ||
    pathname === '/api/auth' ||
    pathname.startsWith('/api/oauth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (authCookie && await verifySessionToken(authCookie)) {
    return NextResponse.next();
  }

  if (!isApiRoute(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
