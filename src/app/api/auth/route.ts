import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_TTL_SECONDS,
  createSessionToken,
} from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (
    !password ||
    !process.env.APP_PASSWORD_HASH ||
    (!process.env.APP_AUTH_SECRET && !process.env.ENCRYPTION_KEY)
  ) {
    return NextResponse.json({ error: 'Invalid configuration' }, { status: 500 });
  }

  const valid = await bcrypt.compare(password, process.env.APP_PASSWORD_HASH);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await createSessionToken();

  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_SESSION_TTL_SECONDS,
    path: '/',
  });

  return res;
}
