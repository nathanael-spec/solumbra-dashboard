/** Reads and writes .env.local without a library. Values with spaces or JSON go in single quotes. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ENV_PATH = resolve(process.cwd(), '.env.local');

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    out[name] = value;
  }
  return out;
}

export function loadEnv(path = ENV_PATH): Record<string, string> {
  if (!existsSync(path)) return {};
  const values = parseEnv(readFileSync(path, 'utf8'));
  for (const [k, v] of Object.entries(values)) if (process.env[k] === undefined) process.env[k] = v;
  return values;
}

function quote(value: string): string {
  return /[\s#'"{}\\]/.test(value) ? `'${value.replace(/'/g, "'\\''")}'` : value;
}

/** Sets or replaces each value in place, keeps every other line, appends what is new. */
export function saveEnv(values: Record<string, string>, path = ENV_PATH): void {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : [];
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (!m || !(m[1] in values)) return line;
    seen.add(m[1]);
    return `${m[1]}=${quote(values[m[1]])}`;
  });
  for (const [k, v] of Object.entries(values)) if (!seen.has(k)) next.push(`${k}=${quote(v)}`);
  writeFileSync(path, next.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').replace(/\n*$/, '\n'));
}

/** The names the dashboard reads. Used to copy .env.local to Vercel. */
export const ENV_NAMES = [
  'BUSINESS_NAME', 'TIMEZONE', 'CURRENCY', 'CHANNELS', 'CATEGORIES', 'TAX_RATE', 'LOGO_URL',
  'DASHBOARD_PASSWORD', 'DASHBOARD_SESSION_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SHEETS_CLIENT_ID', 'GOOGLE_SHEETS_CLIENT_SECRET', 'GOOGLE_SHEETS_REFRESH_TOKEN',
  'PNL_SHEET_ID', 'DASHBOARD_SHEET_ID', 'PIPELINE_SOURCE',
  'CLICKUP_API_TOKEN', 'CLICKUP_TEAM_ID', 'CLICKUP_LIST_ID', 'CLICKUP_WEBHOOK_SECRET',
  'CALCOM_API_KEY', 'INSTANTLY_API_KEY', 'INSTANTLY_TIMEZONE', 'VOLLNA_API_TOKEN', 'VOLLNA_PROFILE_ID', 'STRIPE_API_KEY',
];
