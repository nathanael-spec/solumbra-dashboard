/**
 * Makes the tabs the dashboard reads, inside a sheet you own and have shared
 * with the robot. Used by `npm run setup`. Existing tabs and rows are never
 * touched: a tab is only added when missing, headings only written when the
 * tab is empty.
 */
import { accessToken } from './sheets';
import { PIPELINE_HEADINGS } from './pipelineSheet';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

export const TABS: Record<string, string[]> = {
  Ledger: ['Date', 'In or Out', 'Channel', 'Category', 'Who', 'Amount', 'How paid', 'Status', 'Notes', 'Source id'],
  Recurring: ['Item', 'What it is', 'Monthly', 'Started', 'Notes'],
  'Stage log': ['At', 'Task id', 'Task', 'From', 'To', 'How'],
  Notes: ['Date', 'What', 'Value', 'Why'],
  'Cold email runs': ['Run', 'Since', 'Until', 'People', 'Sent', 'Bounced', 'Bounce %', 'Replies', 'Human', 'Positive', 'Calls', 'Report'],
  Pipeline: PIPELINE_HEADINGS,
};

export async function sheetInfo(sheetId: string): Promise<{ title: string; tabs: string[] }> {
  const token = await accessToken();
  const res = await fetch(`${SHEETS}/${sheetId}?fields=properties.title,sheets.properties.title`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 403) throw new Error('Google says no (403). Share the sheet with the service account email as Editor.');
  if (res.status === 404) throw new Error('Not found (404). Check the sheet id, it is the long part of the address between /d/ and /edit.');
  if (!res.ok) throw new Error(`Google answered ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const body = (await res.json()) as { properties: { title: string }; sheets: { properties: { title: string } }[] };
  return { title: body.properties.title, tabs: body.sheets.map((s) => s.properties.title) };
}

/** Adds the named tabs when missing and writes their headings when empty. Returns what it did. */
export async function ensureTabs(sheetId: string, names: string[]): Promise<string[]> {
  const token = await accessToken();
  const info = await sheetInfo(sheetId);
  const done: string[] = [];
  const missing = names.filter((n) => !info.tabs.includes(n));
  if (missing.length) {
    const res = await fetch(`${SHEETS}/${sheetId}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }), cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Could not add tabs (${res.status}): ${(await res.text()).slice(0, 160)}`);
    done.push(...missing.map((m) => `added the ${m} tab`));
  }
  for (const name of names) {
    const range = `${name}!A1:Z1`;
    const got = await fetch(`${SHEETS}/${sheetId}/values/${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const first = ((await got.json()) as { values?: string[][] }).values?.[0] ?? [];
    if (first.some((c) => String(c).trim())) continue;
    const put = await fetch(`${SHEETS}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [TABS[name]] }), cache: 'no-store',
    });
    if (!put.ok) throw new Error(`Could not write headings on ${name} (${put.status})`);
    done.push(`wrote the headings on ${name}`);
  }
  return done;
}
