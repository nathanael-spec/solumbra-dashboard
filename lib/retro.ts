/**
 * Retrospective numbers for the charts, grouped by day, week or month to fit the
 * period picked at the top of the page. Pure functions, no fetching.
 */
import type { RetroDay } from './types';
import { addDays, daysBetween, weekStart, type Period } from './period';

export type Bucket = 'day' | 'week' | 'month';

export interface RetroBucket {
  start: string; label: string;
  posts: number; impressions: number; measured: number; perPost: number | null;
  followers: number | null; connections: number;
  apps: number; viewed: number; replied: number; hired: number;
  viewRate: number | null; viewToReply: number | null;
  sent: number; replies: number; positive: number; meetings: number; signed: number;
  replyRate: number | null; positiveRate: number | null;
}

/** The real range a period covers in this data: "all time" starts at the first day recorded. */
export function span(days: RetroDay[], p: Period, today: string): { start: string; end: string } {
  const first = days[0]?.date ?? today;
  const start = p.start < first ? first : p.start;
  const end = p.end > today ? today : p.end;
  return { start, end: end < start ? start : end };
}

export function bucketFor(start: string, end: string): Bucket {
  const n = daysBetween(start, end) + 1;
  return n <= 31 ? 'day' : n <= 210 ? 'week' : 'month';
}

const keyOf = (date: string, b: Bucket): string =>
  b === 'day' ? date : b === 'week' ? weekStart(date) : `${date.slice(0, 7)}-01`;

const label = (date: string, b: Bucket): string => {
  const d = new Date(date + 'T12:00:00Z');
  return b === 'month'
    ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const share = (part: number, whole: number): number | null => (whole > 0 ? (100 * part) / whole : null);

function nextKey(key: string, b: Bucket): string {
  if (b === 'day') return addDays(key, 1);
  if (b === 'week') return addDays(key, 7);
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/**
 * One row per bucket from start to end, empty buckets included so a quiet week
 * shows as zero. Followers carry the last known total forward, and stay empty
 * before the first reading.
 */
export function retroSeries(days: RetroDay[], start: string, end: string, bucket = bucketFor(start, end)): RetroBucket[] {
  const rows = new Map<string, RetroBucket>();
  for (let k = keyOf(start, bucket); k <= end; k = nextKey(k, bucket)) {
    rows.set(k, {
      start: k, label: label(k < start ? start : k, bucket),
      posts: 0, impressions: 0, measured: 0, perPost: null, followers: null, connections: 0,
      apps: 0, viewed: 0, replied: 0, hired: 0, viewRate: null, viewToReply: null,
      sent: 0, replies: 0, positive: 0, meetings: 0, signed: 0, replyRate: null, positiveRate: null,
    });
  }
  let lastFollowers: number | null = null;
  for (const d of days) {
    if (d.li_followers !== undefined && d.date < start) lastFollowers = d.li_followers;
  }
  for (const d of days) {
    if (d.date < start || d.date > end) continue;
    const r = rows.get(keyOf(d.date, bucket));
    if (!r) continue;
    r.posts += d.li_posts ?? 0;
    r.impressions += d.li_impressions ?? 0;
    r.measured += d.li_measured ?? 0;
    r.connections += d.li_new_connections ?? 0;
    r.apps += d.uw_apps ?? 0;
    r.viewed += d.uw_viewed ?? 0;
    r.replied += d.uw_replied ?? 0;
    r.hired += d.uw_hired ?? 0;
    r.sent += d.em_sent ?? 0;
    r.replies += d.em_replies ?? 0;
    r.positive += d.em_positive ?? 0;
    r.meetings += d.em_meetings ?? 0;
    r.signed += d.em_signed ?? 0;
    if (d.li_followers !== undefined) r.followers = d.li_followers;
  }
  for (const r of rows.values()) {
    if (r.followers === null) r.followers = lastFollowers;
    else lastFollowers = r.followers;
    r.perPost = r.measured ? Math.round(r.impressions / r.measured) : null;
    r.viewRate = share(r.viewed, r.apps);
    r.viewToReply = share(r.replied, r.viewed);
    r.replyRate = share(r.replies, r.sent);
    r.positiveRate = share(r.positive, r.sent);
  }
  return [...rows.values()];
}
