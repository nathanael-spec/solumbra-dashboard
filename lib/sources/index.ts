import { unstable_cache } from 'next/cache';
import type { Blob, Source, StageEvent, Card } from '../types';
import { has, readConfig } from '../config';
import { attempt, now, off } from './util';
import { readPnl, readDashboardSheet } from './sheets';
import { readCards } from './clickup';
import { readPipelineSheet } from './pipelineSheet';
import { readBookings } from './calcom';
import { readInstantly } from './instantly';
import { readVollna } from './vollna';
import { readStripeBalance } from './stripe';
import { demoBlob } from './demo';

// Vollna allows 30 calls a minute and every read is eight of them, so it keeps
// its own cache: fifteen minutes, untouched by the page's refresh control.
const cachedVollna = unstable_cache(readVollna, ['vollna'], { revalidate: 900, tags: ['vollna'] });

/** One sheet read carries several tabs. This hands each tab its own answer. */
function part<T extends object, K extends keyof T>(s: Source<T>, key: K): Source<T[K]> {
  return s.ok ? { ok: true, data: s.data[key], fetchedAt: s.fetchedAt } : { ok: false, error: s.error, fetchedAt: s.fetchedAt, off: s.off };
}

/** Reads a tool only when its key is present; otherwise says "not connected". */
function when<T>(on: boolean, name: string, fn: () => Promise<T>): Promise<Source<T>> {
  return on ? attempt(name, fn) : Promise.resolve(off<T>());
}

/** Everything the page needs, fetched side by side. A failure in one is reported, not fatal. */
export async function collect(): Promise<Blob> {
  const config = readConfig();
  if (config.demo) return demoBlob(config);

  const [pnl, dash, clickup, sheetPipe, bookings, instantly, vollna, stripe] = await Promise.all([
    when(config.connected.sheets, 'P&L sheet', readPnl),
    when(config.connected.sheets || has('DASHBOARD_SHEET_ID'), 'dashboard sheet', readDashboardSheet),
    when(config.pipeline === 'clickup', 'ClickUp', readCards),
    when(config.pipeline === 'sheet' && config.connected.pipeline, 'Pipeline tab', readPipelineSheet),
    when(config.connected.calcom, 'Cal.com', readBookings),
    when(config.connected.instantly, 'Instantly', () => readInstantly(90)),
    when(config.connected.vollna, 'Vollna', cachedVollna),
    when(config.connected.stripe, 'Stripe', readStripeBalance),
  ]);

  // The stage log is the Stage log tab plus, for a sheet pipeline, the dates on each row.
  let stageLog = part(dash, 'stageLog');
  let cards: Source<Card[]> = config.pipeline === 'clickup' ? clickup : config.pipeline === 'sheet' ? part(sheetPipe, 'cards') : off<Card[]>();
  if (config.pipeline === 'sheet' && sheetPipe.ok) {
    const fromTab: StageEvent[] = stageLog.ok ? stageLog.data : [];
    stageLog = { ok: true, data: [...fromTab, ...sheetPipe.data.events], fetchedAt: sheetPipe.fetchedAt };
  } else if (config.pipeline === 'none' && !stageLog.ok && stageLog.off) {
    cards = off<Card[]>();
  }

  return {
    generatedAt: now(),
    config,
    ledger: part(pnl, 'ledger'),
    recurring: part(pnl, 'recurring'),
    runs: part(dash, 'runs'),
    stageLog,
    notes: part(dash, 'notes'),
    cards, bookings, instantly, vollna, stripe,
  };
}
