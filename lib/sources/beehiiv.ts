/**
 * Beehiiv, the newsletter tool. Two kinds of call per refresh: the publication
 * with its totals, then the list of sign ups, 100 a page. The free plan allows
 * 30 calls a minute, so one refresh reads 20 pages at most.
 *
 * Email addresses are used here to drop test sign ups, then thrown away. They
 * are never returned, so they never reach the browser.
 *
 * Beehiiv gives the day a person signed up, but not the day a person left.
 * That is why nothing here dates an unsubscribe.
 */
import type { NewsletterData, NewsletterStats, NewsletterSub } from '../types';
import { env, getJson } from './util';

const API = 'https://api.beehiiv.com/v2';
const PAGE = 100;
const MAX_PAGES = 20;

interface RawStats {
  total_sent?: number; total_unique_opened?: number; total_clicked?: number;
  average_open_rate?: number; average_click_rate?: number;
}
interface RawPublication { data?: { id?: string; name?: string; stats?: RawStats } }
interface RawSub {
  email?: string; status?: string; created?: number;
  utm_source?: string | null; utm_campaign?: string | null;
}
interface RawList { data?: RawSub[]; has_more?: boolean; next_cursor?: string | null }

/** The substrings in NEWSLETTER_IGNORE_EMAILS, lower case. An address holding any of them is a test sign up. */
export function ignoreList(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isIgnored(email: string | undefined, ignore: string[]): boolean {
  const e = (email ?? '').toLowerCase();
  return ignore.some((part) => e.includes(part));
}

/** Seconds since 1970 to a calendar day in the business timezone. */
export function dayIn(zone: string, seconds: number): string {
  const d = new Date(seconds * 1000);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseStats(raw: RawStats | undefined): NewsletterStats | null {
  if (!raw) return null;
  const sent = finite(raw.total_sent);
  if (sent === null) return null;
  return {
    sent,
    opened: finite(raw.total_unique_opened) ?? 0,
    clicked: finite(raw.total_clicked) ?? 0,
    openRate: finite(raw.average_open_rate),
    clickRate: finite(raw.average_click_rate),
  };
}

/** Raw sign ups to the rows the page uses. Test sign ups are counted and dropped, and no address is kept. */
export function parseSubs(raw: RawSub[], ignore: string[], zone: string): { subs: NewsletterSub[]; ignored: number } {
  const subs: NewsletterSub[] = [];
  let ignored = 0;
  for (const s of raw) {
    if (isIgnored(s.email, ignore)) { ignored++; continue; }
    if (typeof s.created !== 'number') continue;
    subs.push({
      date: dayIn(zone, s.created),
      status: (s.status ?? '').toLowerCase(),
      source: (s.utm_source ?? '').trim(),
      campaign: (s.utm_campaign ?? '').trim(),
    });
  }
  return { subs, ignored };
}

export async function readNewsletter(): Promise<NewsletterData> {
  const headers = { Authorization: `Bearer ${env('BEEHIIV_API_KEY')}` };
  const id = encodeURIComponent(env('BEEHIIV_PUBLICATION_ID').trim());
  const zone = process.env.TIMEZONE?.trim() || 'UTC';
  const ignore = ignoreList(process.env.NEWSLETTER_IGNORE_EMAILS);

  // Beehiiv's pages write this option two ways. The second spelling is tried only when the first brings no totals.
  let pub = await getJson<RawPublication>(`${API}/publications/${id}?expand[]=stats`, headers);
  if (!pub.data?.stats) pub = await getJson<RawPublication>(`${API}/publications/${id}?expand=stats`, headers);

  const raw: RawSub[] = [];
  let cursor = '';
  let capped = false;
  for (let page = 0; ; page++) {
    if (page === MAX_PAGES) { capped = true; break; }
    const body = await getJson<RawList>(
      `${API}/publications/${id}/subscriptions?limit=${PAGE}&order_by=created&direction=asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      headers,
    );
    raw.push(...(body.data ?? []));
    if (!body.has_more || !body.next_cursor) break;
    cursor = body.next_cursor;
  }

  return { ...parseSubs(raw, ignore, zone), stats: parseStats(pub.data?.stats), capped };
}
