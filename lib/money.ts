/**
 * Numbers for the money board that the main dashboard does not have yet:
 * the next charge of each recurring cost, and the value of the pipeline by
 * stage. Pure functions, no fetching, like lib/metrics.ts.
 */
import type { Card, RecurringRow } from './types';
import { STAGES, type Stage } from './stages';

export interface Charge {
  item: string;
  what: string;
  due: string;          // YYYY-MM-DD, the next time it is charged
  amount: number;       // what that charge is, not the monthly share
  every: 'month' | 'year' | 'two years';
  monthly: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function addMonths(start: Date, n: number, day: number): Date {
  const total = start.getUTCMonth() + n;
  const y = start.getUTCFullYear() + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

/**
 * When each recurring cost is charged next. Same rules as
 * scripts/clickup_bills.py in SOLUMBRA-OS, so ClickUp and this page agree:
 * "on the 5th" in the notes sets the day, otherwise the start date's day;
 * "per year" or "yearly" means once a year, "two years" every two years.
 * A row at 0 a month is cancelled and left out.
 */
export function upcomingCharges(recurring: RecurringRow[], today: string): Charge[] {
  const now = new Date(today + 'T00:00:00Z');
  const out: Charge[] = [];
  for (const r of recurring) {
    if (!(r.monthly > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(r.started)) continue;
    const notes = (r.notes ?? '').toLowerCase();
    const step = notes.includes('two years') ? 24 : notes.includes('per year') || notes.includes('yearly') ? 12 : 1;
    const start = new Date(r.started + 'T00:00:00Z');
    const hit = /on the (\d{1,2})(st|nd|rd|th)/.exec(notes);
    const day = hit ? Number(hit[1]) : start.getUTCDate();
    let n = 0;
    let due = start;
    while (due <= now) {
      n += step;
      due = addMonths(start, n, day);
    }
    let amount = r.monthly * step;
    const total = /\$?([\d,]+\.\d\d) (covers|per year)/.exec(r.notes ?? '');
    if (step > 1 && total) amount = Number(total[1].replace(/,/g, ''));
    out.push({
      item: r.item, what: r.what, due: iso(due), monthly: r.monthly,
      amount: Math.round(amount * 100) / 100,
      every: step === 1 ? 'month' : step === 12 ? 'year' : 'two years',
    });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

export interface StageValue { stage: Stage; cards: number; value: number; unpriced: number }

/** Every CRM card counted into its stage, with the Deal value added up. Cards with no value are counted apart. */
export function pipelineValue(cards: Card[]): StageValue[] {
  return STAGES.map((stage) => {
    const here = cards.filter((c) => c.status === stage);
    const value = here.reduce((s, c) => s + (c.dealValue ?? 0), 0);
    return { stage, cards: here.length, value: Math.round(value * 100) / 100, unpriced: here.filter((c) => !c.dealValue).length };
  });
}
