/**
 * Made up numbers for a made up agency, so the dashboard can be looked at
 * before a single tool is connected. `npm run demo` turns it on. Every name
 * here is fictional. The shapes are the same ones the real readers return.
 */
import type { NewsletterSub, RetroData, RetroDay, RetroNumber, Blob, Booking, Card, DashConfig, LedgerRow, Proposal, RecurringRow, StageEvent } from '../types';
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
  ['Maria Lopez', 'Harbor Reception'], ['Tom Becker', 'Northwind Labs'], ['Aisha Rahman', 'Brightline Goods'],
  ['Diego Fuentes', 'Casa Verde Rentals'], ['Hannah Weiss', 'Weiss Family Law'], ['Kenji Sato', 'Sato Property Group'],
  ['Priya Nair', 'Nair Talent Partners'], ['Lucas Moreau', 'Moreau Immigration'], ['Grace Okafor', 'Okafor Estates'],
  ['Sven Lind', 'Lind Coastal Supply'], ['Elena Petrova', 'Petrova Skincare'], ['Omar Haddad', 'Haddad Legal'],
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
  const campaigns = ['01 Ecom welcome flow', '02 Ecom abandoned cart', '03 Ecom win back'].map((name, i) => ({
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

  // A made up newsletter: nine weeks of sign ups, most of them from tagged links, three of them gone again.
  const TAGS: [string, string][] = [['linkedin', 'audit'], ['linkedin', 'audit'], ['linkedin', 'post'], ['', ''], ['website', 'footer'], ['linkedin', 'audit'], ['youtube', '']];
  const subs: NewsletterSub[] = Array.from({ length: 37 }, (_, i) => {
    const [source, campaign] = TAGS[i % TAGS.length];
    return { date: daysAgo(Math.round(62 - i * 1.7)), status: i % 13 === 5 ? 'inactive' : 'active', source, campaign };
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
    vollna: ok({ proposals, connectsBalance: 84, lastSyncAt: new Date(Date.now() - 3600000).toISOString(), from: 'api' as const }),
    stripe: ok({ availableCents: 125000, pendingCents: 80000, currency: 'usd' }),
    retro: ok(demoRetro(daysAgo)),
    newsletter: ok({ subs, stats: { sent: 96, opened: 52, clicked: 11, openRate: 54.2, clickRate: 11.5 }, ignored: 0, capped: false }),
  };
}

/** A made up retrospective, so the Retro screen has something to show in demo mode. */
function demoRetro(daysAgo: (n: number) => string): RetroData {
  const days: RetroDay[] = Array.from({ length: 90 }, (_, i) => {
    const n = 89 - i;
    return {
      date: daysAgo(n), uw_apps: i % 7 < 5 ? 4 : 0, uw_viewed: i % 3 === 0 ? 1 : 0, uw_replied: i % 9 === 0 ? 1 : 0, uw_hired: i % 40 === 0 ? 1 : 0,
      em_sent: 300 + (i % 5) * 20, em_replies: i % 2, em_positive: i % 11 === 0 ? 1 : 0, em_meetings: i % 30 === 0 ? 1 : 0,
      li_posts: 1, li_impressions: 150 + ((i * 37) % 200), li_measured: 1, li_new_connections: i % 2,
      ...(i % 14 === 0 ? { li_followers: 200 + i * 2 } : {}),
    };
  });
  const num = (label: string, now: number, prev: number, all: number, kind: RetroNumber['kind'] = 'num') => ({ label, now, prev, all, kind, lower_better: false });
  return {
    days,
    retros: [{
      date: daysAgo(0), start: daysAgo(13), end: daysAgo(0), prev_start: daysAgo(27), prev_end: daysAgo(14),
      summary: ['Made up numbers for the demo.', 'Cold email replies fell, positive replies held.', 'Upwork views rose after changing which jobs get an application.'],
      changes: [],
      channels: [
        { name: 'LinkedIn', verdict: 'Keep going. Posts that open with a question did best.', keep: [{ what: 'Question in line 1', evidence: '3 of 4 such posts beat the normal' }], change: [], stop: [{ what: 'Tool reviews', evidence: 'Lowest views, 3 times in a row' }], learnings: [{ rule: 'A question in line 1 lifts views', evidence: '3 of 4 posts', status: 'testing' }], next_change: 'Open the next 3 posts with a question.', numbers: [num('Posts made', 14, 12, 90)], funnel: [], top: [{ label: 'Best post', value: '412 views', note: 'question opener' }] },
        { name: 'Upwork', verdict: 'Change the step after the view.', keep: [], change: [{ what: 'Shorter video', evidence: 'Viewed, then no reply, 7 times' }], stop: [], next_change: 'Shorter video on every application.', numbers: [num('Applications sent', 40, 38, 260), num('View rate', 0.25, 0.2, 0.22, 'pct')], funnel: [{ step: 'Sent', count: 40, broken: false }, { step: 'Viewed', count: 10, rate: 0.25, prev_rate: 0.2, normal_rate: 0.22, broken: false }, { step: 'Replied', count: 2, rate: 0.2, prev_rate: 0.4, normal_rate: 0.35, broken: true }, { step: 'Hired', count: 1, rate: 0.5, prev_rate: 0, normal_rate: 0.3, broken: false }] },
        { name: 'Cold email', verdict: 'Stop the old offer, test the new one.', keep: [], change: [], stop: [], next_change: 'Split test two offers, 1,000 sends each.', numbers: [num('Emails sent', 4400, 4100, 27000)], funnel: [{ step: 'Sent', count: 4400, broken: false }, { step: 'Replied', count: 22, rate: 0.005, normal_rate: 0.007, broken: true }, { step: 'Positive', count: 4, rate: 0.18, normal_rate: 0.15, broken: false }] },
      ],
    }],
  };
}
