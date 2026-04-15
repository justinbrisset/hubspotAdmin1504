import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { getAuthorizationUrl } from '@/lib/hubspot/oauth';

export async function GET() {
  const state = nanoid();

  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const url = getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
