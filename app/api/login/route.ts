import { NextResponse } from 'next/server';
import { SESSION_COOKIE, signSession } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';

export async function POST(request: Request): Promise<NextResponse> {
  let password = '';
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
