/**
 * Single-user session tokens.
 *
 * There is exactly one user, forever, so the entire auth system is: one
 * shared password, one HMAC-signed expiry cookie. No user table, no JWT
 * library, no provider config. The token is `${expiryMs}.${hmacHex}` where
 * the HMAC covers the expiry, keyed by SESSION_SECRET.
 *
 * Uses Web Crypto (not node:crypto) so verification also runs in the Edge
 * runtime that middleware.ts executes in.
 */

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const SESSION_COOKIE = 'dash_session';

function secret(): string {
  return process.env.DASHBOARD_SESSION_SECRET ?? '';
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time string compare — the one credential deserves it. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(now = Date.now()): Promise<string> {
  const expiry = String(now + SESSION_MAX_AGE_MS);
  return `${expiry}.${await hmac(expiry)}`;
}

export async function verifySession(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !secret()) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const expiry = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(expiry) || Number(expiry) < now) return false;
  return timingSafeEqual(sig, await hmac(expiry));
}

// Password checking lives in lib/auth/password.ts — it needs the database,
// and this module is imported by middleware.ts, which must stay Edge-safe.
