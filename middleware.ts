import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/auth/session';

export async function middleware(request: NextRequest) {
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
