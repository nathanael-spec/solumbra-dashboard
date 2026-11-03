/**
 * Every number on the dashboard is computed here, from raw rows, with no
 * fetching. That keeps the numbers testable and lets the page filter without
 * asking the server again.
 */
import type { Booking, Card, LedgerRow, Proposal, RecurringRow, RunRow, StageEvent, InstantlyData } from './types';
import { daysBetween, inPeriod, lastWeeks, weekStart } from './period';
import { STAGES, type Stage } from './stages';

export { STAGES, type Stage };
export const OVERHEAD = 'Overhead';
export const CONNECT_PRICE = 0.15;   // what Upwork charges per connect, in dollars

/* ------------------------------------------------------------------ rates */

export interface Rate {
  part: number;
  whole: number;
  pct: number | null;   // null when the sample is too small to read as a percentage
  minN: number;
}

/** The sample size rule: under `minN` in the denominator, a rate is a fraction, never a percentage. */
export function rate(part: number, whole: number, minN = 10): Rate {
  return { part, whole, pct: whole >= minN && whole > 0 ? (100 * part) / whole : null, minN };
}

/* ------------------------------------------------------------------ money */

const isIn = (r: LedgerRow) => r.direction === 'In';
const isOut = (r: LedgerRow) => r.direction === 'Out';
const sum = (rows: LedgerRow[]) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

export interface MoneyTotals {
  revenueIn: number;      // every In row, the sheet's own definition
  costsOut: number;
  profit: number;
  margin: number | null;
  cashCollected: number;  // In rows marked Received
  pendingIn: number;      // In rows marked Pending
}

export function moneyTotals(ledger: LedgerRow[], p: { start: string; end: string }): MoneyTotals {
  const rows = ledger.filter((r) => inPeriod(r.date, p));
  const revenueIn = sum(rows.filter(isIn));
  const costsOut = sum(rows.filter(isOut));
  const profit = Math.round((revenueIn - costsOut) * 100) / 100;
  return {
    revenueIn,
    costsOut,
    profit,
    margin: revenueIn > 0 ? profit / revenueIn : null,
    cashCollected: sum(rows.filter((r) => isIn(r) && r.status === 'Received')),
    pendingIn: sum(rows.filter((r) => isIn(r) && r.status === 'Pending')),
  };
}

export interface MonthPoint { month: string; label: string; inAmt: number; outAmt: number; net: number; running: number }

/** Six rolling months, like the Calc tab: EOMONTH(TODAY(),-6)+1 onward. */
export function monthly(ledger: LedgerRow[], today: string, months = 6): MonthPoint[] {
  const [y, m] = today.split('-').map(Number);
  const out: MonthPoint[] = [];
  let running = 0;
  // Profit to date starts from everything before the first shown month.
  const firstMonth = new Date(Date.UTC(y, m - 1 - (months - 1), 1)).toISOString().slice(0, 7);
  running = sum(ledger.filter((r) => r.date.slice(0, 7) < firstMonth && isIn(r))) - sum(ledger.filter((r) => r.date.slice(0, 7) < firstMonth && isOut(r)));
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    const rows = ledger.filter((r) => r.date.slice(0, 7) === key);
    const inAmt = sum(rows.filter(isIn));
    const outAmt = sum(rows.filter(isOut));
    running = Math.round((running + inAmt - outAmt) * 100) / 100;
    out.push({ month: key, label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), inAmt, outAmt, net: Math.round((inAmt - outAmt) * 100) / 100, running });
  }
  return out;
}

export function spendByCategory(ledger: LedgerRow[], p: { start: string; end: string }): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const r of ledger) if (isOut(r) && inPeriod(r.date, p)) map.set(r.category || 'Other', (map.get(r.category || 'Other') ?? 0) + r.amount);
  return [...map].map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
}

/** Money in by the channel that found the client, biggest first. Received and pending both count, like the sheet's Revenue in. */
export function incomeByChannel(ledger: LedgerRow[], p: { start: string; end: string }): { channel: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const r of ledger) if (isIn(r) && inPeriod(r.date, p)) map.set(r.channel || 'No channel', (map.get(r.channel || 'No channel') ?? 0) + r.amount);
  return [...map].map(([channel, amount]) => ({ channel, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
}

export interface ChannelRow { channel: string; inAmt: number; outAmt: number; net: number; costPerDollar: number | null }

/** One row per channel, Overhead last. `names` is the business's own list, without Overhead. */
export function channels(ledger: LedgerRow[], p: { start: string; end: string }, names: string[]): ChannelRow[] {
  return [...names, OVERHEAD].map((channel) => {
    const rows = ledger.filter((r) => r.channel === channel && inPeriod(r.date, p));
    const inAmt = sum(rows.filter(isIn));
    const outAmt = sum(rows.filter(isOut));
    return { channel, inAmt, outAmt, net: Math.round((inAmt - outAmt) * 100) / 100, costPerDollar: inAmt > 0 ? outAmt / inAmt : null };
  });
}

/** Rows the channel table cannot count: no channel, or a channel outside the list. */
export function unchannelled(ledger: LedgerRow[], names: string[]): LedgerRow[] {
  return ledger.filter((r) => !names.includes(r.channel) && r.channel !== OVERHEAD);
}

export interface Ltv { perClient: number | null; clients: number; total: number }

/** Average cash received per paying client, all time. Small n is the whole story right now. */
export function ltv(ledger: LedgerRow[]): Ltv {
  const paid = ledger.filter((r) => isIn(r) && r.status === 'Received');
  const clients = new Set(paid.map((r) => r.who.trim()).filter(Boolean));
  const total = sum(paid);
  return { perClient: clients.size ? total / clients.size : null, clients: clients.size, total };
}

export function fixedMonthly(recurring: RecurringRow[]): number {
  return Math.round(recurring.reduce((s, r) => s + r.monthly, 0) * 100) / 100;
}

export function daysSinceMoneyIn(ledger: LedgerRow[], today: string): number | null {
  const dates = ledger.filter((r) => isIn(r) && r.status === 'Received').map((r) => r.date).sort();
  return dates.length ? daysBetween(dates[dates.length - 1], today) : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Cash received from the clients behind the won cards, matched on the company or the name. */
export function cashFromWon(ledger: LedgerRow[], won: Card[], p: { start: string; end: string }): number {
  const keys = won.flatMap((c) => [c.company, c.name.split(',').pop() ?? '', c.name]).map(norm).filter((k) => k.length > 3);
  const first = (k: string) => k.split(' ').find((w) => w.length >= 4) ?? '';
  const firsts = new Set(keys.map(first).filter(Boolean));
  const hit = (who: string) => keys.some((k) => who.includes(k) || k.includes(who)) || firsts.has(first(who));
  return sum(ledger.filter((r) => isIn(r) && r.status === 'Received' && inPeriod(r.date, p) && hit(norm(r.who))));
}

/** LTV per channel: cash received over distinct paying clients, all time, by the ledger's own channel column. */
export function ltvByChannel(ledger: LedgerRow[], names: string[]): { channel: string; perClient: number | null; clients: number; total: number }[] {
  return names.map((channel) => {
    const paid = ledger.filter((r) => isIn(r) && r.status === 'Received' && r.channel === channel);
    const clients = new Set(paid.map((r) => r.who.trim()).filter(Boolean)).size;
    const total = sum(paid);
    return { channel, perClient: clients ? total / clients : null, clients, total };
  });
}

/** Days money was received in the period, oldest first, one entry per row. */
export function cashDates(ledger: LedgerRow[], p: { start: string; end: string }): { date: string; amount: number; who: string }[] {
  return ledger.filter((r) => isIn(r) && r.status === 'Received' && inPeriod(r.date, p)).map((r) => ({ date: r.date, amount: r.amount, who: r.who })).sort((a, b) => a.date.localeCompare(b.date));
}

/* --------------------------------------------------------------- pipeline */

/** First time each card reached each stage, from the stage log. */
export function firstEntries(log: StageEvent[]): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const e of log) {
    if (!e.taskId || !e.to) continue;
    const per = out.get(e.taskId) ?? new Map<string, string>();
    const day = e.at.slice(0, 10);
    if (!per.has(e.to) || day < (per.get(e.to) as string)) per.set(e.to, day);
    out.set(e.taskId, per);
  }
  return out;
}

export interface FunnelCounts {
  meetings: number; proposals: number; won: number; lost: number; wonValue: number;
  meetingCards: Card[]; proposalCards: Card[]; wonCards: Card[];
  meetingDates: string[]; proposalDates: string[]; wonDates: string[];   // YYYY-MM-DD, sorted
  estimated: boolean;   // true when any counted date came from the backfill, not a webhook
}

export function funnel(log: StageEvent[], cards: Card[], p: { start: string; end: string }): FunnelCounts {
  const entries = firstEntries(log);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const hits = (stage: Stage): [string, string][] =>
    [...entries].filter(([, per]) => per.has(stage) && inPeriod(per.get(stage) as string, p))
      .map(([id, per]) => [id, per.get(stage) as string] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  const cardOf = (id: string, stage: Stage): Card => {
    const known = byId.get(id);
    if (known) return known;
    const manual = log.find((e) => e.taskId === id);
    const value = manual?.how.match(/value ([\d.]+)/)?.[1];
    return { id, name: manual?.task ?? id, status: stage, url: '', dateCreated: '', dateUpdated: '', dateClosed: null, dueDate: null, company: '', dealValue: value ? Number(value) : null, source: manual?.how.match(/source ([^,]+)/)?.[1] ?? '', offer: '', niche: '', proposalLink: '', meetingLink: '' };
  };
  const m = hits('meeting booked'), pr = hits('proposal sent'), w = hits('closed won');
  const meetingCards = m.map(([id]) => cardOf(id, 'meeting booked'));
  const proposalCards = pr.map(([id]) => cardOf(id, 'proposal sent'));
  const wonCards = w.map(([id]) => cardOf(id, 'closed won'));
  const lost = hits('closed lost').length;
  const estimated = log.some((e) => inPeriod(e.at.slice(0, 10), p) && /backfill/i.test(e.how));
  return {
    meetings: meetingCards.length, proposals: proposalCards.length, won: wonCards.length, lost,
    wonValue: wonCards.reduce((s, c) => s + (c.dealValue ?? 0), 0),
    meetingCards, proposalCards, wonCards, estimated,
    meetingDates: m.map(([, d]) => d), proposalDates: pr.map(([, d]) => d), wonDates: w.map(([, d]) => d),
  };
}

export interface WeekSeries { week: string; meetings: number; proposals: number; won: number; cash: number }

export function weekly(log: StageEvent[], ledger: LedgerRow[], today: string, n = 12): WeekSeries[] {
  const weeks = lastWeeks(today, n);
  const entries = firstEntries(log);
  const rows = weeks.map((week) => ({ week, meetings: 0, proposals: 0, won: 0, cash: 0 }));
  const idx = new Map(weeks.map((w, i) => [w, i]));
  for (const [, per] of entries) {
    for (const [stage, day] of per) {
      const i = idx.get(weekStart(day));
      if (i === undefined) continue;
      if (stage === 'meeting booked') rows[i].meetings++;
      if (stage === 'proposal sent') rows[i].proposals++;
      if (stage === 'closed won') rows[i].won++;
    }
  }
  for (const r of ledger) {
    if (!isIn(r) || r.status !== 'Received') continue;
    const i = idx.get(weekStart(r.date));
    if (i !== undefined) rows[i].cash += r.amount;
  }
  return rows;
}

export function openCards(cards: Card[]): Card[] {
  return cards.filter((c) => c.status !== 'closed won' && c.status !== 'closed lost');
}

export function waitingOnYou(cards: Card[], today: string): Card[] {
  return openCards(cards).filter((c) => c.dueDate && c.dueDate.slice(0, 10) <= today).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}

export function lastMoved(card: Card, log: StageEvent[]): string {
  const days = log.filter((e) => e.taskId === card.id).map((e) => e.at).sort();
  return days.length ? days[days.length - 1] : card.dateUpdated || card.dateCreated;
}

export function staleCards(cards: Card[], log: StageEvent[], today: string, days = 14): { card: Card; daysStill: number }[] {
  return openCards(cards)
    .map((card) => ({ card, daysStill: daysBetween(lastMoved(card, log).slice(0, 10), today) }))
    .filter((x) => x.daysStill >= days)
    .sort((a, b) => b.daysStill - a.daysStill);
}

export function byStage(cards: Card[]): Record<Stage, Card[]> {
  const out = Object.fromEntries(STAGES.map((s) => [s, [] as Card[]])) as Record<Stage, Card[]>;
  for (const c of cards) if ((STAGES as string[]).includes(c.status)) out[c.status as Stage].push(c);
  return out;
}

export function bookingsIn(bookings: Booking[], p: { start: string; end: string }): Booking[] {
  return bookings.filter((b) => inPeriod(b.createdAt.slice(0, 10), p) && b.status !== 'cancelled' && b.status !== 'rejected');
}

export function upcomingBookings(bookings: Booking[], nowIso: string): Booking[] {
  return bookings.filter((b) => b.start >= nowIso && b.status !== 'cancelled' && b.status !== 'rejected').sort((a, b) => a.start.localeCompare(b.start));
}

/** Spend per client and per meeting, by channel. The card's Source decides the channel. */
export interface ChannelEconomics { channel: string; spend: number; clients: number; meetings: number; cac: number | null; costPerMeeting: number | null }

export function channelEconomics(ledger: LedgerRow[], log: StageEvent[], cards: Card[], p: { start: string; end: string }, names: string[], channelOf: (source: string) => string): ChannelEconomics[] {
  const f = funnel(log, cards, p);
  return names.map((channel) => {
    const spend = sum(ledger.filter((r) => isOut(r) && r.channel === channel && inPeriod(r.date, p)));
    const clients = f.wonCards.filter((c) => channelOf(c.source) === channel).length;
    const meetings = f.meetingCards.filter((c) => channelOf(c.source) === channel).length;
    return { channel, spend, clients, meetings, cac: clients ? spend / clients : null, costPerMeeting: meetings ? spend / meetings : null };
  });
}

/* ------------------------------------------------------------- cold email */

export interface EmailPeriod { sent: number; people: number; humanReplies: number; machineReplies: number; days: number }

export function emailPeriod(data: InstantlyData, p: { start: string; end: string }): EmailPeriod {
  const pts = data.daily.filter((d) => inPeriod(d.date, p));
  return {
    sent: pts.reduce((s, d) => s + d.sent, 0),
    people: pts.reduce((s, d) => s + d.newPeople, 0),
    humanReplies: pts.reduce((s, d) => s + d.replies, 0),
    machineReplies: pts.reduce((s, d) => s + d.repliesAutomatic, 0),
    days: pts.length,
  };
}

export function emailAllTime(data: InstantlyData): { sent: number; bounced: number; people: number; human: number; bounceRate: Rate; humanRate: Rate } {
  const sent = data.campaigns.reduce((s, c) => s + c.sentAllTime, 0);
  const bounced = data.campaigns.reduce((s, c) => s + c.bouncedAllTime, 0);
  const people = data.campaigns.reduce((s, c) => s + c.peopleAllTime, 0);
  const human = data.campaigns.reduce((s, c) => s + c.humanRepliesAllTime, 0);
  return { sent, bounced, people, human, bounceRate: rate(bounced, sent), humanRate: rate(human, people) };
}

export function latestRun(runs: RunRow[]): RunRow | null {
  return runs.length ? [...runs].sort((a, b) => a.run.localeCompare(b.run))[runs.length - 1] : null;
}

export function runsTotals(runs: RunRow[]): { people: number; sent: number; positive: number; calls: number; positiveRate: Rate; meetingsPerThousand: number | null } {
  const people = runs.reduce((s, r) => s + r.people, 0);
  const sent = runs.reduce((s, r) => s + r.sent, 0);
  const positive = runs.reduce((s, r) => s + r.positive, 0);
  const calls = runs.reduce((s, r) => s + r.calls, 0);
  return { people, sent, positive, calls, positiveRate: rate(positive, people, 100), meetingsPerThousand: sent ? (1000 * calls) / sent : null };
}

/** Days since a new person was emailed, from the daily series. Null when never. */
export function daysSinceNewPerson(data: InstantlyData, today: string): number | null {
  const days = data.daily.filter((d) => d.newPeople > 0).map((d) => d.date).sort();
  return days.length ? daysBetween(days[days.length - 1], today) : null;
}

export function mailboxHealth(data: InstantlyData): { total: number; sending: number; warming: number; notSending: string[]; lowScore: string[] } {
  const sending = data.mailboxes.filter((m) => m.status === 1);
  return {
    total: data.mailboxes.length,
    sending: sending.length,
    warming: data.mailboxes.filter((m) => m.warmupStatus === 1).length,
    notSending: data.mailboxes.filter((m) => m.status !== 1).map((m) => m.email),
    lowScore: data.mailboxes.filter((m) => m.warmupScore < 90).map((m) => m.email),
  };
}

/* ----------------------------------------------------------------- upwork */

/**
 * Upwork rates read as a percentage in every period, however short it is,
 * because a week of applications is what he actually steers on. The fraction
 * behind the percentage is always printed next to it, and under THIN_SAMPLE
 * applications the page says in words that the number moves a lot. That is the
 * sample size rule kept honest without hiding the percentage.
 *
 * The five rates are the ones his proposal tracker shows, computed the same way:
 *   view rate        viewed  / sent    a client opened the application
 *   reply rate       replied / sent    a client wrote back
 *   conversion rate  replied / viewed  of the ones who read it, who answered
 *   cost per reply   connects spent, in dollars, / replies
 *   client cost      connects spent, in dollars, / hires
 */
export const THIN_SAMPLE = 50;

/** A rate that always resolves to a percentage when there is anything in the denominator. */
const upRate = (part: number, whole: number): Rate => rate(part, whole, 1);
const dollarsPer = (dollars: number, n: number): number | null => (n > 0 ? Math.round((dollars / n) * 100) / 100 : null);

export interface UpworkPeriod {
  sent: number; viewed: number; replies: number; hired: number; withdrawn: number;
  connects: number; boosts: number; dollars: number;
  viewRate: Rate; replyRate: Rate; conversionRate: Rate; hireRate: Rate; replyToHire: Rate;
  costPerReply: number | null;
  cac: number | null;          // what one client won cost in connects
  thin: boolean;               // fewer applications than THIN_SAMPLE, so every rate is jumpy
  proposals: Proposal[];
}

export function upworkPeriod(proposals: Proposal[], p: { start: string; end: string }): UpworkPeriod {
  const rows = proposals.filter((x) => inPeriod(x.submittedAt.slice(0, 10), p));
  const live = rows.filter((x) => !x.withdrawn);
  const viewed = live.filter((x) => x.viewed).length;
  const replies = live.filter((x) => x.interviewed).length;
  const hired = live.filter((x) => x.hired).length;
  // Vollna's `connects` already includes the boost, so the boost is not added again.
  const connects = rows.reduce((s, x) => s + x.connects, 0);
  const dollars = Math.round(connects * CONNECT_PRICE * 100) / 100;
  return {
    sent: live.length, viewed, replies, hired, withdrawn: rows.length - live.length,
    connects, boosts: rows.filter((x) => x.boost > 0).length, dollars,
    viewRate: upRate(viewed, live.length),
    replyRate: upRate(replies, live.length),
    conversionRate: upRate(replies, viewed),
    hireRate: upRate(hired, live.length),
    replyToHire: upRate(hired, replies),
    costPerReply: dollarsPer(dollars, replies),
    cac: dollarsPer(dollars, hired),
    thin: live.length < THIN_SAMPLE,
    proposals: rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  };
}

export function upworkWeekly(proposals: Proposal[], today: string, n = 12): { week: string; sent: number; viewed: number; interviewed: number; hired: number }[] {
  const weeks = lastWeeks(today, n);
  const idx = new Map(weeks.map((w, i) => [w, i]));
  const rows = weeks.map((week) => ({ week, sent: 0, viewed: 0, interviewed: 0, hired: 0 }));
  for (const x of proposals) {
    if (x.withdrawn) continue;
    const i = idx.get(weekStart(x.submittedAt.slice(0, 10)));
    if (i === undefined) continue;
    rows[i].sent++;
    if (x.viewed) rows[i].viewed++;
    if (x.interviewed) rows[i].interviewed++;
    if (x.hired) rows[i].hired++;
  }
  return rows;
}

/** Period comparison in words a person can read at a glance. */
export function delta(now: number, before: number | null, fmt: (n: number) => string = String): { diff: number; text: string } | null {
  if (before === null) return null;
  const diff = Math.round((now - before) * 100) / 100;
  if (diff === 0) return { diff, text: 'same as the period before' };
  return { diff, text: `${diff > 0 ? 'up' : 'down'} ${fmt(Math.abs(diff))} on the period before` };
}
