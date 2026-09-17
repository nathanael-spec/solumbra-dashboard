/**
 * Made up numbers for a made up agency, so the dashboard can be looked at
 * before a single tool is connected. `npm run demo` turns it on. Every name
 * here is fictional. The shapes are the same ones the real readers return.
 */
import type { Blob, Booking, Card, DashConfig, LedgerRow, Proposal, RecurringRow, StageEvent } from '../types';
import { now } from './util';

const DAY = 86400000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * DAY));

/** A small deterministic random, so the demo looks the same on every load. */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

const PEOPLE = [
  ['Maria Lopez', 'Harbor Reception'], ['Tom Becker', 'Northwind Labs'], ['Aisha Rahman', 'Brightline Staffing'],
  ['Diego Fuentes', 'Casa Verde Rentals'], ['Hannah Weiss', 'Weiss Family Law'], ['Kenji Sato', 'Sato Property Group'],
  ['Priya Nair', 'Nair Talent Partners'], ['Lucas Moreau', 'Moreau Immigration'], ['Grace Okafor', 'Okafor Estates'],
  ['Sven Lind', 'Lind Coastal Stays'], ['Elena Petrova', 'Petrova Recruiting'], ['Omar Haddad', 'Haddad Legal'],
];
const SOURCES = ['Upwork', 'Cold email', 'Referral', 'Website'];

export function demoBlob(config: DashConfig): Blob {
  const r = rng(7);
  const channels = config.channels.length ? config.channels : ['Upwork', 'Cold email', 'Network', 'Website'];
  const ch = (source: string) => channels.find((c) => c.toLowerCase() === source.toLowerCase()) ?? channels[Math.min(2, channels.length - 1)];

  const ledger: LedgerRow[] = [];
  const cards: Card[] = [];
  const log: StageEvent[] = [];
  const row = (date: string, direction: string, channel: string, category: string, who: string, amount: number, howPaid: string, status: string) =>
    ledger.push({ date, direction, channel, category, who, amount, howPaid, status, notes: '', sourceId: '' });

  // Recurring costs, three months of them.
  for (let m = 0; m < 4; m++) {
    const d = new Date(); d.setUTCMonth(d.getUTCMonth() - m, 3);
    row(ymd(d), 'Out', 'Overhead', 'Software', 'Google Workspace', 14.4, 'Card', 'Paid');
    row(ymd(d), 'Out', 'Overhead', 'Education', 'Skool', 186, 'Card', 'Paid');
    row(ymd(d), 'Out', ch('Cold email'), 'Software', 'Instantly', 97, 'Card', 'Paid');
    row(ymd(d), 'Out', ch('Cold email'), 'Software', 'Mailboxes', 52, 'Card', 'Paid');
    row(ymd(d), 'Out', ch('Upwork'), 'Lead generation', 'Upwork connects', 60 + Math.round(r() * 60), 'Card', 'Paid');
  }

  // Twelve leads over ten weeks, each walking some way down the pipeline.
  PEOPLE.forEach(([who, company], i) => {
    const source = SOURCES[i % SOURCES.length];
    const start = 66 - i * 5 - Math.round(r() * 3);
    const id = `demo-${i + 1}`;
    const name = `${who}, ${company}`;
    const stamp = (n: number) => `${daysAgo(n)}T15:00:00Z`;
    const push = (to: string, n: number, from = '') => log.push({ at: stamp(n), taskId: id, task: name, from, to, how: 'demo' });
    push('intake', start);
    let status = 'intake';
    const value = [1500, 2500, 4000, 6500, 900, 3200][i % 6];
    // Fixed pattern, not random, so every week and this month have something in them.
    if (i % 4 !== 3) { push('meeting booked', start - 3, 'intake'); status = 'meeting booked'; }
    if (status === 'meeting booked' && i % 3 !== 2) { push('proposal sent', start - 6, 'meeting booked'); status = 'proposal sent'; }
    if (status === 'proposal sent' && start - 10 >= 0) {
      if (i % 2 === 0) {
        push('closed won', start - 10, 'proposal sent'); status = 'closed won';
        row(daysAgo(start - 12), 'In', ch(source), 'Build', company, value * 0.5, 'Stripe card', 'Received');
        row(daysAgo(Math.max(0, start - 26)), 'In', ch(source), 'Build', company, value * 0.5, 'Stripe card', start - 26 > 0 ? 'Received' : 'Pending');
        row(daysAgo(start - 12), 'Out', ch(source), 'Payment fee', 'Stripe', Math.round(value * 0.5 * 0.029 * 100) / 100, 'Taken automatically', 'Paid');
      } else if (i % 5 === 4) { push('closed lost', start - 11, 'proposal sent'); status = 'closed lost'; }
    }
    const open = status !== 'closed won' && status !== 'closed lost';
    cards.push({
      id, name, status, rawStatus: status, url: '', dateCreated: stamp(start), dateUpdated: stamp(Math.max(0, start - 10)), dateClosed: open ? null : stamp(start - 10),
      dueDate: open && r() < 0.6 ? stamp(Math.round(r() * 6) - 2) : null,
      company, dealValue: value, source, offer: ['Build', 'Consultation', 'Maintenance'][i % 3], niche: '', proposalLink: '', meetingLink: '',
    });
  });

  const recurring: RecurringRow[] = [
    { item: 'Google Workspace', what: 'Email and files', monthly: 14.4, started: daysAgo(120) },
    { item: 'Instantly', what: 'Cold email sender', monthly: 97, started: daysAgo(100) },
    { item: 'Mailboxes', what: 'Sending domains', monthly: 52, started: daysAgo(100) },
    { item: 'Skool', what: 'Course', monthly: 186, started: daysAgo(90) },
  ];

  const bookings: Booking[] = [1, 3, 6].map((n, i) => ({
    id: `b${i}`, title: 'Discovery call', status: 'accepted', start: new Date(Date.now() + n * DAY).toISOString(), end: new Date(Date.now() + n * DAY + 1800000).toISOString(),
    createdAt: new Date(Date.now() - (i + 1) * DAY).toISOString(), name: PEOPLE[9 + i][0], email: '', revenueBand: '',
  }));

  const daily = Array.from({ length: 90 }, (_, i) => {
    const d = new Date(Date.now() - (89 - i) * DAY);
    const weekend = [0, 6].includes(d.getUTCDay());
    const sent = weekend ? 0 : 180 + Math.round(r() * 60);
    return { date: ymd(d), sent, newPeople: weekend ? 0 : Math.round(sent * 0.45), replies: weekend ? 0 : Math.round(r() * 4), repliesAutomatic: weekend ? 0 : Math.round(r() * 6) };
  });
  const sentAll = daily.reduce((s, d) => s + d.sent, 0);
  const campaigns = ['01 Staffing agencies', '02 Short term rentals', '03 Law firms'].map((name, i) => ({
    id: `c${i}`, name, status: i === 2 ? 2 : 1, statusLabel: i === 2 ? 'paused' : 'active', dailyLimit: 80, sendsToday: i !== 2,
    leads: 900, sentAllTime: Math.round(sentAll / 3), bouncedAllTime: Math.round(sentAll / 3 * 0.021), peopleAllTime: Math.round(sentAll / 3 * 0.45),
    humanRepliesAllTime: 9 + i * 3, machineRepliesAllTime: 20, sentToday: i === 2 ? 0 : 61, bouncedToday: 1, peopleToday: 27, humanRepliesToday: i === 0 ? 1 : 0,
  }));
  const mailboxes = Array.from({ length: 12 }, (_, i) => ({ email: `hello${i + 1}@example-outreach.com`, status: i === 11 ? -1 : 1, warmupStatus: 1, warmupScore: 92 + (i % 8), dailyLimit: 20 }));

  const proposals: Proposal[] = Array.from({ length: 64 }, (_, i) => {
    const n = Math.round(i * 1.3);
    const viewed = r() < 0.3, interviewed = viewed && r() < 0.4, hired = interviewed && r() < 0.3;
    return {
      uid: `p${i}`, submittedAt: `${daysAgo(n)}T14:00:00Z`, title: ['Automate our intake', 'CRM cleanup and follow ups', 'Airbnb pricing automation', 'Zapier to Make migration', 'AI receptionist for a clinic'][i % 5],
      client: PEOPLE[i % PEOPLE.length][1], connects: [8, 12, 16][i % 3], boost: i % 7 === 0 ? 10 : 0, viewed, interviewed, hired, withdrawn: i % 23 === 0, invitation: false, position: null, responseMinutes: null,
    };
  });

  const stamp = now();
  const ok = <T,>(data: T) => ({ ok: true as const, data, fetchedAt: stamp });
  return {
    generatedAt: stamp,
    config,
    ledger: ok(ledger), recurring: ok(recurring),
    runs: ok([{ run: daysAgo(20), since: daysAgo(48), until: daysAgo(21), people: 1400, sent: 3100, bounced: 68, bouncePct: 2.2, replies: 41, human: 19, positive: 4, calls: 2, report: '' }]),
    stageLog: ok(log), notes: ok([]),
    cards: ok(cards), bookings: ok(bookings),
    instantly: ok({ campaigns, daily, mailboxes, today: daysAgo(0), ceiling: 160, campaignCeiling: 160, mailboxCeiling: 220, windowShare: 0.6, windowOpen: true }),
    vollna: ok({ proposals, connectsBalance: 84, lastSyncAt: new Date(Date.now() - 3600000).toISOString() }),
    stripe: ok({ availableCents: 125000, pendingCents: 80000, currency: 'usd' }),
  };
}
