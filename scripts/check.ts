/**
 * Reads every connected tool once and says what came back. Nothing is written.
 *
 *   npm run check
 */
import { loadEnv } from './env';
loadEnv();

import { readConfig } from '../lib/config';
import { readPnl, readDashboardSheet, readUpworkSheet } from '../lib/sources/sheets';
import { readCards } from '../lib/sources/clickup';
import { readPipelineSheet } from '../lib/sources/pipelineSheet';
import { readBookings } from '../lib/sources/calcom';
import { readInstantly } from '../lib/sources/instantly';
import { readVollna } from '../lib/sources/vollna';
import { readStripeBalance } from '../lib/sources/stripe';

type Row = { name: string; state: 'ok' | 'failed' | 'not connected'; detail: string };

export async function checkAll(): Promise<Row[]> {
  const c = readConfig();
  const rows: Row[] = [];
  const run = async (name: string, on: boolean, fn: () => Promise<string>) => {
    if (!on) return rows.push({ name, state: 'not connected', detail: '' });
    try {
      rows.push({ name, state: 'ok', detail: await fn() });
    } catch (e) {
      rows.push({ name, state: 'failed', detail: e instanceof Error ? e.message : String(e) });
    }
  };
  await run('P&L sheet', c.connected.sheets, async () => { const p = await readPnl(); return `${p.ledger.length} ledger rows, ${p.recurring.length} recurring`; });
  await run('Dashboard tabs', c.connected.sheets, async () => { const d = await readDashboardSheet(); return `${d.stageLog.length} stage events, ${d.notes.length} notes, ${d.runs.length} runs`; });
  if (c.pipeline === 'clickup') await run('ClickUp', true, async () => { const k = await readCards(); return `${k.length} cards`; });
  else if (c.pipeline === 'sheet') await run('Pipeline tab', c.connected.pipeline, async () => { const k = await readPipelineSheet(); return `${k.cards.length} rows, ${k.events.length} dated stage changes`; });
  else rows.push({ name: 'Pipeline', state: 'not connected', detail: 'manual entries only' });
  await run('Cal.com', c.connected.calcom, async () => `${(await readBookings()).length} bookings`);
  await run('Instantly', c.connected.instantly, async () => { const i = await readInstantly(30); return `${i.campaigns.length} campaigns, ${i.mailboxes.length} mailboxes`; });
  await run('Vollna', c.connected.vollna, async () => { const v = await readVollna(); return `${v.proposals.length} applications, balance ${v.connectsBalance ?? 'unknown'}`; });
  await run('Upwork proposals tab', c.connected.sheets, async () => { const v = await readUpworkSheet(); return `${v.proposals.length} applications, newest ${v.lastSyncAt?.slice(0, 10) ?? 'unknown'}`; });
  await run('Stripe', c.connected.stripe, async () => { const s = await readStripeBalance(); return `available ${(s.availableCents / 100).toFixed(2)}`; });
  return rows;
}

export function printRows(rows: Row[]): void {
  const w = Math.max(...rows.map((r) => r.name.length)) + 2;
  for (const r of rows) {
    const mark = r.state === 'ok' ? 'ok     ' : r.state === 'failed' ? 'FAILED ' : 'off    ';
    console.log(`  ${mark}${r.name.padEnd(w)}${r.detail}`);
  }
}

if (process.argv[1]?.endsWith('check.ts')) {
  const c = readConfig();
  console.log(`\n${c.businessName}, ${c.timezone}, ${c.currency}, channels: ${c.channels.join(', ')}${c.demo ? ' (DEMO)' : ''}\n`);
  checkAll().then((rows) => {
    printRows(rows);
    const bad = rows.filter((r) => r.state === 'failed').length;
    console.log(bad ? `\n${bad} failed. Fix the key or the sharing and run npm run check again.\n` : '\nEverything connected answers.\n');
    process.exit(bad ? 1 : 0);
  });
}
