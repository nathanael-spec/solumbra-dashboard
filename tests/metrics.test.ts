import { describe, expect, it } from 'vitest';
import ledgerRows from './fixtures/ledger.json';
import { parseLedger, parseProposals, sheetDate } from '@/lib/sources/sheets';
import { cashFromWon, channels, funnel, ltv, moneyTotals, monthly, rate, upworkPeriod, weekly, daysSinceMoneyIn } from '@/lib/metrics';
import { channelOf, stageOf } from '@/lib/stages';
import { parsePipeline } from '@/lib/sources/pipelineSheet';
import { splitNameValue } from '@/lib/sources/clickup';
import { makePeriod } from '@/lib/period';
import type { StageEvent, Proposal } from '@/lib/types';

const ledger = parseLedger(ledgerRows as unknown as string[][]);
const TODAY = '2026-09-17';
const all = makePeriod('all', TODAY);
const NAMES = ['Upwork', 'Cold email', 'Network', 'Website'];

describe('money, against the Dashboard cells of the sheet the fixture was copied from', () => {
  it('matches REVENUE IN, COSTS OUT and PROFIT to the cent', () => {
    const m = moneyTotals(ledger, all);
    expect(m.revenueIn).toBe(1210);
    expect(m.costsOut).toBe(1507.25);
    expect(m.profit).toBe(-297.25);
  });
  it('cash collected counts only Received rows', () => {
    const m = moneyTotals(ledger, all);
    expect(m.cashCollected).toBe(1150);
    expect(m.pendingIn).toBe(60);
  });
  it('channels follow the configured list, Overhead last, and Overhead earns nothing', () => {
    const c = channels(ledger, all, NAMES);
    expect(c.map((x) => x.channel)).toEqual(['Upwork', 'Cold email', 'Network', 'Website', 'Overhead']);
    expect(c.find((x) => x.channel === 'Network')?.inAmt).toBe(1000);
    expect(c.find((x) => x.channel === 'Overhead')?.inAmt).toBe(0);
    expect(c.find((x) => x.channel === 'Website')?.costPerDollar).toBeNull();
  });
  it('LTV is cash received per distinct paying client', () => {
    const l = ltv(ledger);
    expect(l.clients).toBe(4);
    expect(l.total).toBe(1150);
    expect(l.perClient).toBeCloseTo(287.5);
  });
  it('monthly running total ends at the all time profit', () => {
    const m = monthly(ledger, TODAY, 6);
    expect(m[m.length - 1].running).toBe(-297.25);
    expect(m[m.length - 1].month).toBe('2026-09');
  });
  it('days since money came in reads the newest In row', () => {
    expect(daysSinceMoneyIn(ledger, TODAY)).toBe(2);
  });
  it('sheet dates in either form become YYYY-MM-DD', () => {
    expect(sheetDate('2026-09-15')).toBe('2026-09-15');
    expect(sheetDate(46280)).toBe('2026-09-15');
  });
});

describe('periods', () => {
  it('week starts on Monday, month and quarter are calendar', () => {
    expect(makePeriod('week', TODAY).start).toBe('2026-09-14');
    expect(makePeriod('month', TODAY).start).toBe('2026-09-01');
    expect(makePeriod('quarter', TODAY).start).toBe('2026-07-01');
    expect(makePeriod('quarter', TODAY).compareStart).toBe('2026-04-13');
  });
  it('custom swaps a backwards range and labels it', () => {
    const c = makePeriod('custom', TODAY, { start: '2026-09-08', end: '2026-08-07' });
    expect([c.start, c.end]).toEqual(['2026-08-07', '2026-09-08']);
    expect(c.label).toBe('Aug 7 to Sep 8');
  });
  it('funnel hands back the dates behind each count', () => {
    const log = [
      { at: '2026-09-02T10:00:00Z', taskId: 'a', task: 'A', from: '', to: 'meeting booked', how: 'webhook' },
      { at: '2026-09-04T10:00:00Z', taskId: 'manual-1', task: 'Coffee with Ana', from: '', to: 'meeting booked', how: 'manual, source Network' },
    ];
    const f = funnel(log, [], all);
    expect(f.meetingDates).toEqual(['2026-09-02', '2026-09-04']);
    expect(f.meetingCards[1].name).toBe('Coffee with Ana');
    expect(f.meetingCards[1].source).toBe('Network');
  });
});

describe('cash from the won clients', () => {
  it('matches a card to its ledger rows by company, name, or first word', () => {
    const card = (name: string, company: string) => ({ id: name, name, status: 'closed won', url: '', dateCreated: '', dateUpdated: '', dateClosed: null, dueDate: null, company, dealValue: null, source: '', offer: '', niche: '', proposalLink: '', meetingLink: '' });
    const won = [card('Maria Lopez, Harbor Reception', 'Harbor Reception'), card('Tom Becker, Northwind Labs LLC', 'Northwind Labs LLC'), card('Aisha Rahman, Brightline Talent', 'Brightline Talent')];
    expect(cashFromWon(ledger, won, { start: '2026-09-01', end: '2026-09-30' })).toBe(150);
    expect(cashFromWon(ledger, won, all)).toBe(150);
  });
});

describe('rates keep the sample size rule', () => {
  it('shows a fraction under the floor and a percentage above it', () => {
    expect(rate(2, 6).pct).toBeNull();
    expect(rate(3, 10).pct).toBe(30);
    expect(rate(6, 40, 50).pct).toBeNull();
  });
});

describe('pipeline funnel from the stage log', () => {
  const log: StageEvent[] = [
    { at: '2026-09-01T10:00:00Z', taskId: 'a', task: 'A', from: '', to: 'intake', how: 'webhook' },
    { at: '2026-09-02T10:00:00Z', taskId: 'a', task: 'A', from: 'intake', to: 'meeting booked', how: 'webhook' },
    { at: '2026-09-05T10:00:00Z', taskId: 'a', task: 'A', from: 'meeting booked', to: 'proposal sent', how: 'webhook' },
    { at: '2026-09-09T10:00:00Z', taskId: 'a', task: 'A', from: 'proposal sent', to: 'closed won', how: 'webhook' },
    { at: '2026-09-03T10:00:00Z', taskId: 'b', task: 'B', from: '', to: 'meeting booked', how: 'backfill, estimated' },
    { at: '2026-09-12T10:00:00Z', taskId: 'b', task: 'B', from: 'meeting booked', to: 'closed lost', how: 'webhook' },
    { at: '2026-09-11T10:00:00Z', taskId: 'a', task: 'A', from: 'closed won', to: 'meeting booked', how: 'webhook' },
  ];
  const cards = [
    { id: 'a', name: 'A', status: 'closed won', url: '', dateCreated: '', dateUpdated: '', dateClosed: null, dueDate: null, company: 'A co', dealValue: 2500, source: 'Upwork', offer: '', niche: '', proposalLink: '', meetingLink: '' },
    { id: 'b', name: 'B', status: 'closed lost', url: '', dateCreated: '', dateUpdated: '', dateClosed: null, dueDate: null, company: 'B co', dealValue: null, source: 'Referral', offer: '', niche: '', proposalLink: '', meetingLink: '' },
  ];
  it('counts first entries only, once per card and stage', () => {
    const f = funnel(log, cards, { start: '2026-09-01', end: '2026-09-30' });
    expect(f.meetings).toBe(2);
    expect(f.proposals).toBe(1);
    expect(f.won).toBe(1);
    expect(f.lost).toBe(1);
    expect(f.wonValue).toBe(2500);
    expect(f.estimated).toBe(true);
  });
  it('respects the period', () => {
    const f = funnel(log, cards, { start: '2026-09-08', end: '2026-09-30' });
    expect(f.meetings).toBe(0);
    expect(f.won).toBe(1);
  });
  it('weekly series lands events in the right Monday bucket', () => {
    const w = weekly(log, ledger, TODAY, 4);
    expect(w.map((x) => x.week)).toEqual(['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14']);
    expect(w[1].meetings).toBe(2);
    expect(w[2].won).toBe(1);
    expect(w[3].cash).toBe(100);
  });
});

describe('upwork', () => {
  const p = (d: string, extra: Partial<Proposal> = {}): Proposal => ({
    uid: d, submittedAt: d + 'T12:00:00Z', title: 't', client: '', connects: 10, boost: 0,
    viewed: false, interviewed: false, hired: false, withdrawn: false, invitation: false, position: null, responseMinutes: null, ...extra,
  });
  it('excludes withdrawn from the sent count, charges their connects, and never adds the boost twice', () => {
    const u = upworkPeriod([p('2026-09-10', { viewed: true }), p('2026-09-11', { withdrawn: true }), p('2026-09-12', { boost: 5 })], all);
    expect(u.sent).toBe(2);
    expect(u.withdrawn).toBe(1);
    expect(u.connects).toBe(30);
    expect(u.dollars).toBeCloseTo(4.5);
  });
  it('the five rates, on a sample small enough to fit a single week', () => {
    // 10 sent, 5 viewed, 2 of those replied, 1 of those hired. 100 connects, $15.
    const rows = [
      p('2026-09-14', { uid: 'a', viewed: true, interviewed: true, hired: true }),
      p('2026-09-15', { uid: 'b', viewed: true, interviewed: true }),
      p('2026-09-16', { uid: 'c', viewed: true }),
      p('2026-09-16', { uid: 'd', viewed: true }),
      p('2026-09-17', { uid: 'e', viewed: true }),
      ...Array.from({ length: 5 }, (_, i) => p('2026-09-17', { uid: 'f' + i })),
    ];
    const week = makePeriod('week', TODAY);
    const u = upworkPeriod(rows, week);
    expect(u.sent).toBe(10);
    expect(u.viewed).toBe(5);
    expect(u.replies).toBe(2);
    expect(u.hired).toBe(1);
    expect(u.viewRate.pct).toBe(50);        // viewed / sent
    expect(u.replyRate.pct).toBe(20);       // replied / sent
    expect(u.conversionRate.pct).toBe(40);  // replied / viewed
    expect(u.hireRate.pct).toBe(10);        // hired / sent
    expect(u.dollars).toBeCloseTo(15);
    expect(u.costPerReply).toBeCloseTo(7.5);
    expect(u.cac).toBeCloseTo(15);
    expect(u.thin).toBe(true);
  });
  it('a rate with nothing in the denominator stays empty, and per unit costs stay null', () => {
    const u = upworkPeriod([], all);
    expect(u.viewRate.pct).toBeNull();
    expect(u.conversionRate.pct).toBeNull();
    expect(u.costPerReply).toBeNull();
    expect(u.cac).toBeNull();
  });
  it('a hundred applications is no longer a thin sample', () => {
    const rows = Array.from({ length: 100 }, (_, i) => p('2026-09-1' + (i % 8), { uid: 'n' + i, viewed: i % 4 === 0 }));
    expect(upworkPeriod(rows, all).thin).toBe(false);
  });
});

describe('stage and channel names from any CRM', () => {
  it('reads free text stage names into the five stages', () => {
    expect(stageOf('Discovery call booked')).toBe('meeting booked');
    expect(stageOf('Proposal / quote sent')).toBe('proposal sent');
    expect(stageOf('Won 🎉')).toBe('closed won');
    expect(stageOf('Lost')).toBe('closed lost');
    expect(stageOf('New lead')).toBe('intake');
    expect(stageOf('closed won')).toBe('closed won');
  });
  it('maps a card source onto the configured channels', () => {
    expect(channelOf('Upwork', NAMES)).toBe('Upwork');
    expect(channelOf('Referral from Ana', NAMES)).toBe('Network');
    expect(channelOf('Cold email (Instantly)', NAMES)).toBe('Cold email');
    expect(channelOf('Website / inbound', NAMES)).toBe('Website');
    expect(channelOf('LinkedIn DM', ['Marketplaces', 'Outreach'])).toBe('Marketplaces');
  });
  it('turns a Pipeline tab into cards and dated stage events', () => {
    const rows = [
      ['Name', 'Company', 'Stage', 'Source', 'Deal value', 'Due date', 'Link', 'Meeting booked on', 'Proposal sent on', 'Closed on', 'Created on'],
      ['Maria Lopez', 'Harbor Reception', 'Won', 'Referral', '2500', '', '', '2026-09-02', '2026-09-05', '2026-09-09', '2026-09-01'],
      ['Tom Becker', 'Northwind', 'Call booked', 'Upwork', '', '2026-09-20', '', '2026-09-10', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', ''],
    ];
    const { cards, events } = parsePipeline(rows);
    expect(cards.map((c) => c.status)).toEqual(['closed won', 'meeting booked']);
    expect(cards[0].dealValue).toBe(2500);
    const f = funnel(events, cards, { start: '2026-09-01', end: '2026-09-30' });
    expect(f.meetings).toBe(2);
    expect(f.proposals).toBe(1);
    expect(f.won).toBe(1);
    expect(f.wonDates).toEqual(['2026-09-09']);
  });
});

describe('a deal value written into the ClickUp card name', () => {
  it('reads the amount and gives back the name without it', () => {
    expect(splitNameValue('$300 · Maria Lopez, Harbor Reception')).toEqual({ name: 'Maria Lopez, Harbor Reception', value: 300 });
    expect(splitNameValue('$2,500 · Tom Becker, Northwind')).toEqual({ name: 'Tom Becker, Northwind', value: 2500 });
    expect(splitNameValue('$1,234.50 · Ada Reyes')).toEqual({ name: 'Ada Reyes', value: 1234.5 });
    expect(splitNameValue('$10 • Sam Okafor')).toEqual({ name: 'Sam Okafor', value: 10 });
  });
  it('leaves a normal name alone', () => {
    expect(splitNameValue('Maria Lopez, Harbor Reception')).toEqual({ name: 'Maria Lopez, Harbor Reception', value: null });
    expect(splitNameValue('Priced at $300')).toEqual({ name: 'Priced at $300', value: null });
    expect(splitNameValue('$ · Tom Becker')).toEqual({ name: '$ · Tom Becker', value: null });
  });
});

describe('the Upwork proposals tab', () => {
  const rows = [
    ['Sent at', 'Job', 'Client', 'Connects', 'Boost', 'Position', 'Response minutes', 'Viewed', 'Replied', 'Hired', 'Withdrawn', 'Invitation', 'Uid', 'Job url'],
    ['2026-09-10 11:00:00', 'GHL snapshot', 'United States', '70', '50', '4', '18', 'yes', 'yes', 'yes', '', '', 'a1', 'https://x'],
    ['2026-09-09 09:00:00', 'Something else', 'Spain', '12', '', '', '', '', '', '', '', '', 'a2', 'https://y'],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];
  const got = parseProposals(rows);

  it('drops the empty rows and keeps the rest', () => {
    expect(got.length).toBe(2);
  });

  it('reads the three stages as separate answers', () => {
    expect(got[0]).toMatchObject({ viewed: true, interviewed: true, hired: true, connects: 70, boost: 50, position: 4, responseMinutes: 18 });
    expect(got[1]).toMatchObject({ viewed: false, interviewed: false, hired: false, boost: 0 });
  });

  it('leaves an unknown position or speed empty rather than calling it zero', () => {
    expect(got[1].position).toBe(null);
    expect(got[1].responseMinutes).toBe(null);
  });
});
