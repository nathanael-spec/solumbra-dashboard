import type { Source } from '../types';

export const UA = 'solumbra-dashboard/1.0 (open source, github.com/nathanael-spec/solumbra-dashboard)';

export function now(): string {
  return new Date().toISOString();
}

export function fail<T>(error: string): Source<T> {
  return { ok: false, error, fetchedAt: now() };
}

/** The answer for a tool that was never connected. The page shows it as "not connected", never as broken. */
export function off<T>(): Source<T> {
  return { ok: false, error: 'not connected', fetchedAt: now(), off: true };
}

export function good<T>(data: T): Source<T> {
  return { ok: true, data, fetchedAt: now() };
}

/** Runs a reader and turns any throw into a plain language failure. */
export async function attempt<T>(name: string, fn: () => Promise<T>): Promise<Source<T>> {
  try {
    return good(await fn());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[dashboard] ${name}: ${message}`);
    return fail(message);
  }
}

export async function getJson<T = unknown>(
  url: string,
  headers: Record<string, string>,
  init: RequestInit = {},
): Promise<T> {
  let res: Response | null = null;
  // A 429 means "too fast", never "no". Wait and ask again, three times at most.
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers, ...(init.headers as Record<string, string> | undefined) },
      cache: 'no-store',
    });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
  }
  if (!res) throw new Error(`no answer from ${new URL(url).host}`);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`${res.status} from ${new URL(url).host}: ${body}`);
  }
  return (await res.json()) as T;
}

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Run "npm run setup", or add it to .env.local here and to the Vercel project.`);
  return v;
}

export function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[$€£,\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function msToIso(ms: string | number | null | undefined): string | null {
  if (ms === null || ms === undefined || ms === '') return null;
  const n = Number(ms);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
