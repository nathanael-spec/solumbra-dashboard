/**
 * Google Sheets, read and write, with a permission that only covers
 * spreadsheets. Two ways in, and the code picks whichever is configured:
 *
 *   1. A service account (GOOGLE_SERVICE_ACCOUNT_JSON). A robot Google user
 *      with its own email address. You share the sheet with that address,
 *      and it signs its own hour long keys. Nothing expires. This is what
 *      `npm run setup` walks you through.
 *   2. A refresh token from your own Google account (GOOGLE_SHEETS_CLIENT_ID,
 *      GOOGLE_SHEETS_CLIENT_SECRET, GOOGLE_SHEETS_REFRESH_TOKEN), limited to
 *      the spreadsheets scope. Also permanent while the OAuth app is Internal
 *      or published.
 *
 * Either way the hour long access key is kept in memory and renewed early.
 */
import { createSign } from 'node:crypto';
import type { LedgerRow, RecurringRow, RunRow, StageEvent, NoteRow, Proposal, VollnaData } from '../types';
import { env, num } from './util';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
let cached: { token: string; expires: number } | null = null;

interface ServiceAccount { client_email: string; private_key: string }

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const j = JSON.parse(text) as Partial<ServiceAccount>;
    if (!j.client_email || !j.private_key) throw new Error('missing client_email or private_key');
    return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n') };
  } catch (e) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is not the JSON key file Google gave you (${e instanceof Error ? e.message : e}).`);
  }
}

async function tokenFromServiceAccount(a: ServiceAccount): Promise<{ access_token: string; expires_in: number }> {
  const at = Math.floor(Date.now() / 1000);
  const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iss: a.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: at, exp: at + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(a.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Google would not accept the service account (${res.status}). Usually the Google Sheets API is not switched on in that project, or the key was deleted. ${(await res.text()).slice(0, 160)}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

async function tokenFromRefresh(): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_SHEETS_CLIENT_ID'),
      client_secret: env('GOOGLE_SHEETS_CLIENT_SECRET'),
      refresh_token: env('GOOGLE_SHEETS_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Google refused the spreadsheet permission (${res.status}). The refresh token has probably expired or been revoked. Make a new one, or switch to a service account with "npm run setup".`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token;
  const a = serviceAccount();
  const body = a ? await tokenFromServiceAccount(a) : await tokenFromRefresh();
  cached = { token: body.access_token, expires: Date.now() + (body.expires_in - 300) * 1000 };
  return cached.token;
}

export async function readRanges(sheetId: string, ranges: string[]): Promise<Record<string, string[][]>> {
  const token = await accessToken();
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const res = await fetch(
    `${SHEETS}/${sheetId}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!res.ok) {
    const text = (await res.text()).slice(0, 160);
    if (res.status === 403) throw new Error(`Google says no to sheet ${sheetId} (403). Share the sheet with the service account email as Editor, then refresh.`);
    if (res.status === 404) throw new Error(`Sheet ${sheetId} was not found (404). Check the id in .env.local, it is the long part of the sheet's address.`);
    throw new Error(`Could not read the sheet (${res.status}): ${text}`);
  }
  const body = (await res.json()) as { valueRanges: { range: string; values?: string[][] }[] };
  const out: Record<string, string[][]> = {};
  body.valueRanges.forEach((vr, i) => {
    out[ranges[i]] = vr.values ?? [];
  });
  return out;
}

export async function appendRows(sheetId: string, range: string, rows: (string | number)[][]): Promise<void> {
  const token = await accessToken();
  const res = await fetch(
    `${SHEETS}/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`Could not write to the sheet (${res.status}): ${(await res.text()).slice(0, 160)}`);
}

/** Columns are found by their heading, not their position, like pnl_rebuild.py does. */
function byHeading(rows: string[][]): { col: (name: string) => number; body: string[][] } {
  const head = (rows[0] ?? []).map((h) => String(h).trim().toLowerCase());
  return {
    col: (name) => head.indexOf(name.toLowerCase()),
    body: rows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')),
  };
}

const cell = (r: string[], i: number): string => (i < 0 ? '' : String(r[i] ?? '').trim());

/** A sheet date arrives as text (YYYY-MM-DD) or as a serial number. Both become YYYY-MM-DD. */
export function sheetDate(v: unknown): string {
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

export function parseLedger(rows: string[][]): LedgerRow[] {
  const { col, body } = byHeading(rows);
  const c = {
    date: col('date'), dir: col('in or out'), channel: col('channel'), category: col('category'),
    who: col('who'), amount: col('amount'), how: col('how paid'), status: col('status'),
    notes: col('notes'), source: col('source id'),
  };
  return body
    .filter((r) => cell(r, c.date) !== '')
    .map((r) => ({
      date: sheetDate(r[c.date]),
      direction: cell(r, c.dir),
      channel: cell(r, c.channel),
      category: cell(r, c.category),
      who: cell(r, c.who),
      amount: num(r[c.amount]),
      howPaid: cell(r, c.how),
      status: cell(r, c.status),
      notes: cell(r, c.notes),
      sourceId: cell(r, c.source),
    }));
}

export function parseRecurring(rows: string[][]): RecurringRow[] {
  const { col, body } = byHeading(rows);
  const c = { item: col('item'), what: col('what it is'), monthly: col('monthly'), started: col('started'), notes: col('notes') };
  return body
    .filter((r) => cell(r, c.item) !== '')
    .map((r) => ({ item: cell(r, c.item), what: cell(r, c.what), monthly: num(r[c.monthly]), started: sheetDate(r[c.started]), notes: c.notes >= 0 ? cell(r, c.notes) : '' }));
}

export function parseRuns(rows: string[][]): RunRow[] {
  const { col, body } = byHeading(rows);
  return body.map((r) => ({
    run: sheetDate(r[col('run')]), since: cell(r, col('since')), until: sheetDate(r[col('until')]),
    people: num(r[col('people')]), sent: num(r[col('sent')]), bounced: num(r[col('bounced')]),
    bouncePct: num(r[col('bounce %')]), replies: num(r[col('replies')]), human: num(r[col('human')]),
    positive: num(r[col('positive')]), calls: num(r[col('calls')]), report: cell(r, col('report')),
  }));
}

export function parseStageLog(rows: string[][]): StageEvent[] {
  const { col, body } = byHeading(rows);
  return body.map((r) => ({
    at: cell(r, col('at')), taskId: cell(r, col('task id')), task: cell(r, col('task')),
    from: cell(r, col('from')).toLowerCase(), to: cell(r, col('to')).toLowerCase(), how: cell(r, col('how')),
  }));
}

export function parseNotes(rows: string[][]): NoteRow[] {
  const { col, body } = byHeading(rows);
  return body.map((r) => ({ date: sheetDate(r[col('date')]), what: cell(r, col('what')), value: cell(r, col('value')), why: cell(r, col('why')) }));
}

export async function readPnl(): Promise<{ ledger: LedgerRow[]; recurring: RecurringRow[] }> {
  const id = env('PNL_SHEET_ID');
  const got = await readRanges(id, ['Ledger!A1:J1000', 'Recurring!A1:E200']);
  return { ledger: parseLedger(got['Ledger!A1:J1000']), recurring: parseRecurring(got['Recurring!A1:E200']) };
}

/** The dashboard's own tabs. They may live in the P&L sheet or in a second sheet. */
export function dashboardSheetId(): string {
  return process.env.DASHBOARD_SHEET_ID || env('PNL_SHEET_ID');
}

export async function readDashboardSheet(): Promise<{ runs: RunRow[]; stageLog: StageEvent[]; notes: NoteRow[] }> {
  const id = dashboardSheetId();
  const got = await readRanges(id, ['Cold email runs!A1:L500', 'Stage log!A1:F5000', 'Notes!A1:D500']);
  return {
    runs: parseRuns(got['Cold email runs!A1:L500']),
    stageLog: parseStageLog(got['Stage log!A1:F5000']),
    notes: parseNotes(got['Notes!A1:D500']),
  };
}

/**
 * Upwork proposals kept in a sheet tab instead of read from Vollna's API.
 * Vollna's own API is on their top plan; on any plan below it their website
 * still exports every proposal as a CSV file, and that file is what fills this
 * tab. Columns are found by heading, so the tab can carry extra columns the
 * dashboard ignores.
 */
export function parseProposals(rows: string[][]): Proposal[] {
  const { col, body } = byHeading(rows);
  const c = {
    at: col('sent at'), title: col('job'), client: col('client'),
    connects: col('connects'), boost: col('boost'), position: col('position'),
    minutes: col('response minutes'), viewed: col('viewed'), replied: col('replied'),
    hired: col('hired'), withdrawn: col('withdrawn'), invitation: col('invitation'), uid: col('uid'),
  };
  const flag = (r: string[], i: number) => ['yes', 'true', '1'].includes(cell(r, i).toLowerCase());
  const maybe = (r: string[], i: number) => (cell(r, i) === '' ? null : num(r[i]));
  return body
    .filter((r) => cell(r, c.at) !== '')
    .map((r, i) => ({
      uid: cell(r, c.uid) || `row-${i}`,
      submittedAt: cell(r, c.at),
      title: cell(r, c.title) || '(job post removed)',
      client: cell(r, c.client),
      connects: num(r[c.connects]),
      boost: num(r[c.boost]),
      viewed: flag(r, c.viewed),
      interviewed: flag(r, c.replied),
      hired: flag(r, c.hired),
      withdrawn: flag(r, c.withdrawn),
      invitation: flag(r, c.invitation),
      position: maybe(r, c.position),
      responseMinutes: maybe(r, c.minutes),
    }));
}

/** Reads the "Upwork proposals" tab on its own, so a missing tab only costs the Upwork screen. */
export async function readUpworkSheet(): Promise<VollnaData> {
  const id = dashboardSheetId();
  let got: Record<string, string[][]>;
  try {
    got = await readRanges(id, ['Upwork proposals!A1:Z2000']);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(
      /Unable to parse range|not found/i.test(why)
        ? 'There is no "Upwork proposals" tab in the dashboard sheet yet. Export your proposals from vollna.com and put them in a tab with that name.'
        : why,
    );
  }
  const proposals = parseProposals(got['Upwork proposals!A1:Z2000']);
  const lastSyncAt = proposals.length
    ? proposals.map((p) => p.submittedAt).sort().slice(-1)[0]
    : null;
  return { proposals, connectsBalance: null, lastSyncAt, from: 'sheet' };
}

export async function logStageChange(event: StageEvent): Promise<void> {
  await appendRows(dashboardSheetId(), 'Stage log!A1', [[event.at, event.taskId, event.task, event.from, event.to, event.how]]);
}
