/**
 * The retrospective sheet (RETRO_SHEET_ID). Two tabs:
 *
 *   Daily    one row per day, every channel's numbers, found by heading text
 *   Retros   one row per retrospective, the whole write up as JSON in column F
 *
 * The sheet is written by the /retrospective routine. This only reads it.
 */
import type { RetroData, RetroDay, RetroRecord } from '../types';
import { env, num } from './util';
import { readRanges, sheetDate } from './sheets';

/** Heading text in the Daily tab, to the key the page uses. */
export const DAILY_HEADINGS: Record<string, keyof Omit<RetroDay, 'date'>> = {
  'upwork apps sent': 'uw_apps',
  'upwork viewed': 'uw_viewed',
  'upwork replied': 'uw_replied',
  'upwork offers sent': 'uw_offers',
  'upwork hired': 'uw_hired',
  'emails sent': 'em_sent',
  'email replies (people)': 'em_replies',
  'email positive replies': 'em_positive',
  'meetings booked': 'em_meetings',
  'signed': 'em_signed',
  'emails bounced': 'em_bounced',
  'linkedin posts': 'li_posts',
  'linkedin impressions': 'li_impressions',
  'posts with a view count': 'li_measured',
  'new connections accepted': 'li_new_connections',
  'followers (total that day)': 'li_followers',
  'connections (total that day)': 'li_connections',
};

export function parseDaily(rows: unknown[][]): RetroDay[] {
  if (!rows.length) return [];
  const head = rows[0].map((h) => String(h ?? '').trim().toLowerCase());
  const out: RetroDay[] = [];
  for (const r of rows.slice(1)) {
    const date = sheetDate(r[0]);
    if (!date) continue;
    const day: RetroDay = { date };
    head.forEach((h, i) => {
      const key = DAILY_HEADINGS[h];
      const v = r[i];
      if (key && v !== '' && v !== null && v !== undefined) day[key] = num(v);
    });
    out.push(day);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseRetros(rows: unknown[][]): RetroRecord[] {
  const out: RetroRecord[] = [];
  for (const r of rows.slice(1)) {
    const raw = r[5];
    if (!raw) continue;
    try {
      out.push(JSON.parse(String(raw)) as RetroRecord);
    } catch {
      // A broken row is skipped. The routine rewrites the whole tab every time.
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function readRetro(): Promise<RetroData> {
  const id = env('RETRO_SHEET_ID');
  const got = await readRanges(id, ['Daily!A1:Z3000', 'Retros!A1:F500']);
  return { days: parseDaily(got['Daily!A1:Z3000']), retros: parseRetros(got['Retros!A1:F500']) };
}
