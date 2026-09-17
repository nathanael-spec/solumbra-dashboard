/**
 * Instantly, the cold email sender. Five calls per refresh, against a limit of
 * twenty a minute. Rules inherited from instantly_today.py and retro_data.py:
 * people are new_leads_contacted_count, never contacted_count; there is no
 * open rate, tracking is off on purpose; the day's ceiling is the smaller of
 * the campaign limits and the mailbox limits.
 */
import type { CampaignStats, DailyPoint, InstantlyData, Mailbox } from '../types';
import { env, getJson } from './util';

const API = 'https://api.instantly.ai/api/v2';
// The zone the campaign schedules are set in. Instantly shows it on each campaign's schedule tab.
const ZONE = process.env.INSTANTLY_TIMEZONE?.trim() || process.env.TIMEZONE?.trim() || 'UTC';

const STATUS: Record<number, string> = {
  0: 'draft', 1: 'active', 2: 'paused', 3: 'completed, follow ups only', 4: 'running subsequences',
  [-1]: 'accounts unhealthy', [-2]: 'halted by bounce protection', [-99]: 'account suspended',
};

interface RawCampaign {
  id: string; name: string; status: number; daily_limit?: number;
  campaign_schedule?: { schedules?: { days?: Record<string, boolean>; timing?: { from: string; to: string }; timezone?: string }[]; start_date?: string; end_date?: string };
}
interface RawAnalytics {
  campaign_id: string; leads_count: number; emails_sent_count: number; bounced_count: number;
  new_leads_contacted_count: number; reply_count_unique: number; reply_count_automatic: number;
}
interface RawDaily { date: string; sent: number; new_leads_contacted: number; unique_replies: number; unique_replies_automatic: number }
interface RawAccount { email: string; status: number; warmup_status: number; stat_warmup_score?: number; daily_limit?: number }

function zoneParts(d: Date): { date: string; weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: days.indexOf(get('weekday')),
    minutes: Number(get('hour')) % 24 * 60 + Number(get('minute')),
  };
}

function sendsOn(c: RawCampaign, weekday: number, date: string): boolean {
  const sch = c.campaign_schedule;
  if (!sch) return true;
  if (sch.start_date && date < sch.start_date) return false;
  if (sch.end_date && date > sch.end_date) return false;
  return (sch.schedules ?? []).some((s) => s.days?.[String(weekday)]);
}

export async function readInstantly(daysBack = 90): Promise<InstantlyData> {
  const headers = { Authorization: `Bearer ${env('INSTANTLY_API_KEY')}` };
  const nowZ = zoneParts(new Date());
  const today = nowZ.date;
  const first = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);

  const [campaignsBody, allTime, todayStats, daily, accountsBody] = await Promise.all([
    getJson<{ items: RawCampaign[] }>(`${API}/campaigns?limit=100`, headers),
    getJson<RawAnalytics[]>(`${API}/campaigns/analytics`, headers),
    getJson<RawAnalytics[]>(`${API}/campaigns/analytics?start_date=${today}&end_date=${today}`, headers),
    getJson<RawDaily[]>(`${API}/campaigns/analytics/daily?start_date=${first}&end_date=${today}`, headers),
    getJson<{ items: RawAccount[] }>(`${API}/accounts?limit=100`, headers),
  ]);

  const ever = new Map(allTime.map((a) => [a.campaign_id, a]));
  const day = new Map(todayStats.map((a) => [a.campaign_id, a]));
  let campaignCeiling = 0;
  const campaigns: CampaignStats[] = campaignsBody.items.map((c) => {
    const e = ever.get(c.id);
    const d = day.get(c.id);
    const live = c.status === 1 && sendsOn(c, nowZ.weekday, today);
    if (live) campaignCeiling += c.daily_limit ?? 0;
    return {
      id: c.id, name: c.name, status: c.status, statusLabel: STATUS[c.status] ?? `status ${c.status}`,
      dailyLimit: c.daily_limit ?? 0, sendsToday: live,
      leads: e?.leads_count ?? 0,
      sentAllTime: e?.emails_sent_count ?? 0, bouncedAllTime: e?.bounced_count ?? 0,
      peopleAllTime: e?.new_leads_contacted_count ?? 0,
      humanRepliesAllTime: e?.reply_count_unique ?? 0, machineRepliesAllTime: e?.reply_count_automatic ?? 0,
      sentToday: d?.emails_sent_count ?? 0, bouncedToday: d?.bounced_count ?? 0,
      peopleToday: d?.new_leads_contacted_count ?? 0, humanRepliesToday: d?.reply_count_unique ?? 0,
    };
  });

  const mailboxes: Mailbox[] = accountsBody.items.map((a) => ({
    email: a.email, status: a.status, warmupStatus: a.warmup_status, warmupScore: a.stat_warmup_score ?? 0, dailyLimit: a.daily_limit ?? 0,
  }));
  const mailboxCeiling = mailboxes.filter((m) => m.status === 1).reduce((s, m) => s + m.dailyLimit, 0);
  const ceiling = campaignCeiling ? Math.min(campaignCeiling, mailboxCeiling) : 0;

  const open = 7 * 60, close = 19 * 60;
  const windowShare = Math.max(0, Math.min(1, (nowZ.minutes - open) / (close - open)));

  const series: DailyPoint[] = daily.map((p) => ({
    date: p.date, sent: p.sent, newPeople: p.new_leads_contacted, replies: p.unique_replies, repliesAutomatic: p.unique_replies_automatic,
  }));

  return { campaigns, daily: series, mailboxes, today, ceiling, campaignCeiling, mailboxCeiling, windowShare, windowOpen: nowZ.minutes >= open && nowZ.minutes < close && nowZ.weekday !== 0 };
}
