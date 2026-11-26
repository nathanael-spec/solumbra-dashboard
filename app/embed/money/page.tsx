import type { Metadata } from 'next';
import { getBlob } from '@/lib/cache/blob';
import { MoneyBoard, type BoardPeriod } from '@/components/MoneyBoard';
import { makePeriod } from '@/lib/period';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Solumbra money', robots: { index: false, follow: false } };

function todayIn(zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const PERIODS = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

function pick(key: string, today: string): BoardPeriod {
  if (key === 'year') {
    const y = Number(today.slice(0, 4));
    const doy = Math.round((Date.parse(today) - Date.parse(`${y}-01-01`)) / 864e5);
    const prevEnd = new Date(Date.parse(`${y - 1}-01-01`) + doy * 864e5).toISOString().slice(0, 10);
    return { key, label: 'This year', start: `${y}-01-01`, end: today, compareStart: `${y - 1}-01-01`, compareEnd: prevEnd };
  }
  const p = makePeriod(key === 'quarter' || key === 'all' ? key : 'month', today);
  return { key: p.key, label: p.label, start: p.start, end: p.end, compareStart: p.compareStart, compareEnd: p.compareEnd };
}

/**
 * The money board for the ClickUp Embed card. The middleware only lets a
 * request in with the right ?k= token, so no login cookie is needed inside
 * ClickUp's frame.
 */
export default async function EmbedMoney({ searchParams }: { searchParams: Promise<{ p?: string; k?: string }> }) {
  const sp = await searchParams;
  const blob = await getBlob();
  const today = todayIn(blob.config.timezone);
  return <MoneyBoard blob={blob} period={pick(sp.p ?? 'month', today)} periods={PERIODS} today={today} token={sp.k ?? ''} />;
}
