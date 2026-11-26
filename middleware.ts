import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/auth/session';

/** Same length and every byte compared, so the answer time says nothing about the token. */
function sameToken(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function middleware(request: NextRequest) {
  // The ClickUp money board. ClickUp shows it in a frame, where a login cookie
  // would be blocked, so it opens with a long secret in the link instead.
  if (request.nextUrl.pathname.startsWith('/embed/')) {
    const ok = sameToken(request.nextUrl.searchParams.get('k') ?? '', process.env.MONEY_EMBED_TOKEN?.trim() ?? '');
    return ok ? NextResponse.next() : new NextResponse('Not allowed.', { status: 401 });
  }
  // Demo mode with no password set is an open door on purpose: it shows made up numbers.
  if (process.env.DEMO === '1' && !process.env.DASHBOARD_PASSWORD) return NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) return NextResponse.next();

  // API callers get a status code; humans get the login page.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = '';
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login page, its API route, and static assets.
  // The icons stay open: the browser asks for them before anyone has
  // logged in, and a gated favicon renders as a blank tab.
  matcher: [
    '/((?!login|api/login|api/hooks|_next/static|_next/image|favicon.ico|icon.svg|icon.png|apple-icon.png|fonts|logo.png).*)',
  ],
};
