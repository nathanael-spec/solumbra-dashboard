export type PeriodKey = 'week' | 'month' | 'quarter' | 'all' | 'custom';

export interface Period {
  key: PeriodKey;
  label: string;
  start: string;        // YYYY-MM-DD inclusive
  end: string;          // YYYY-MM-DD inclusive
  compareStart?: string;
  compareEnd?: string;
}

export const PERIOD_KEYS: PeriodKey[] = ['week', 'month', 'quarter', 'all', 'custom'];

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/** ISO date of the Monday that starts the week holding `date`. */
export function weekStart(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return ymd(d);
}

function shortLabel(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The period before, of the same length, for the "up 2 on the period before" line. */
function withCompare(p: Omit<Period, 'compareStart' | 'compareEnd'>): Period {
  const len = daysBetween(p.start, p.end) + 1;
  return { ...p, compareStart: addDays(p.start, -len), compareEnd: addDays(p.start, -1) };
}

export function makePeriod(key: PeriodKey, today: string, custom?: { start: string; end: string }): Period {
  const [y, m] = today.split('-').map(Number);
  switch (key) {
    case 'week':
      return withCompare({ key, label: 'This week', start: weekStart(today), end: today });
    case 'month':
      return withCompare({ key, label: 'This month', start: `${today.slice(0, 7)}-01`, end: today });
    case 'quarter': {
      const qm = Math.floor((m - 1) / 3) * 3 + 1;
      return withCompare({ key, label: 'This quarter', start: `${y}-${String(qm).padStart(2, '0')}-01`, end: today });
    }
    case 'custom': {
      const start = custom?.start || addDays(today, -29);
      const end = custom?.end || today;
      const a = start <= end ? start : end;
      const b = start <= end ? end : start;
      return withCompare({ key, label: `${shortLabel(a)} to ${shortLabel(b)}`, start: a, end: b });
    }
    default:
      return { key: 'all', label: 'All time', start: '2000-01-01', end: '2999-12-31' };
  }
}

export const inPeriod = (date: string, p: { start: string; end: string }): boolean =>
  date >= p.start && date <= p.end;

/** The last `n` week starts ending with the week that holds `today`. */
export function lastWeeks(today: string, n: number): string[] {
  const end = weekStart(today);
  return Array.from({ length: n }, (_, i) => addDays(end, -7 * (n - 1 - i)));
}

/** Weeks for the small charts: the period plus two weeks before it, at least 6, never more than 26. */
export function weeksToShow(p: Period, today: string): number {
  if (p.key === 'all') return 26;
  const span = Math.ceil((daysBetween(weekStart(p.start), today) + 1) / 7);
  return Math.max(6, Math.min(26, span + 2));
}

export function rangeLabel(p: Period): string {
  if (p.key === 'all') return 'everything ever recorded';
  const f = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(p.start)} to ${f(p.end)}`;
}
