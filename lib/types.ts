/** Every reader answers with one of these, so a broken tool never blanks the page. */
export type Source<T> =
  | { ok: true; data: T; fetchedAt: string }
  | { ok: false; error: string; fetchedAt: string; off?: boolean };   // off: not connected, on purpose

export type PipelineKind = 'clickup' | 'sheet' | 'none';

/** Who this dashboard is for, read from the environment. See lib/config.ts. */
export interface DashConfig {
  businessName: string;
  timezone: string;        // IANA name, like America/Chicago
  currency: string;        // ISO code, like USD
  channels: string[];      // the ways clients are found, without Overhead
  categories: string[];    // what money comes in for
  taxRate: number;         // share of profit to set aside, 0.28 means 28%
  pipeline: PipelineKind;
  connected: { sheets: boolean; pipeline: boolean; calcom: boolean; instantly: boolean; vollna: boolean; stripe: boolean; retro: boolean };
  demo: boolean;
  logoUrl: string;
  proposalsUrl: string;  // where proposals are published, blank hides the link
  weekUrl: string;       // the weekly content review page (LinkedIn week), blank hides the link
}

export interface LedgerRow {
  date: string;          // YYYY-MM-DD
  direction: 'In' | 'Out' | string;
  channel: string;
  category: string;
  who: string;
  amount: number;
  howPaid: string;
  status: string;        // Received, Paid, Pending, Refunded
  notes: string;
  sourceId: string;
}

export interface RecurringRow {
  item: string;
  what: string;
  monthly: number;
  started: string;
}

export interface RunRow {
  run: string; since: string; until: string;
  people: number; sent: number; bounced: number; bouncePct: number;
  replies: number; human: number; positive: number; calls: number; report: string;
}

export interface StageEvent {
  at: string;            // ISO
  taskId: string;
  task: string;
  from: string;
  to: string;
  how: string;           // webhook, or backfill with a note
}

export interface NoteRow { date: string; what: string; value: string; why: string }

export interface Card {
  id: string;
  name: string;
  status: string;        // one of the five stages, see lib/stages.ts
  rawStatus?: string;    // what the CRM actually calls it
  url: string;
  dateCreated: string;
  dateUpdated: string;
  dateClosed: string | null;
  dueDate: string | null;
  company: string;
  dealValue: number | null;
  source: string;
  offer: string;
  niche: string;
  proposalLink: string;
  meetingLink: string;
}

export interface Booking {
  id: string;
  title: string;
  status: string;
  start: string;
  end: string;
  createdAt: string;
  name: string;
  email: string;
  revenueBand: string;
}

export interface CampaignStats {
  id: string;
  name: string;
  status: number;
  statusLabel: string;
  dailyLimit: number;
  sendsToday: boolean;
  leads: number;
  sentAllTime: number;
  bouncedAllTime: number;
  peopleAllTime: number;      // new_leads_contacted_count, never contacted_count
  humanRepliesAllTime: number;
  machineRepliesAllTime: number;
  sentToday: number;
  bouncedToday: number;
  peopleToday: number;
  humanRepliesToday: number;
}

export interface DailyPoint {
  date: string; sent: number; newPeople: number; replies: number; repliesAutomatic: number;
}

export interface Mailbox { email: string; status: number; warmupStatus: number; warmupScore: number; dailyLimit: number }

export interface InstantlyData {
  campaigns: CampaignStats[];
  daily: DailyPoint[];
  mailboxes: Mailbox[];
  today: string;            // YYYY-MM-DD in the sending timezone
  ceiling: number;          // the smaller of the two ceilings
  campaignCeiling: number;
  mailboxCeiling: number;
  windowShare: number;      // 0..1, how much of the 07:00 to 19:00 sending day has passed
  windowOpen: boolean;
}

export interface Proposal {
  uid: string;
  submittedAt: string;
  title: string;
  client: string;
  connects: number;
  boost: number;
  viewed: boolean;
  interviewed: boolean;
  hired: boolean;
  withdrawn: boolean;
  invitation: boolean;
  position: number | null;
  responseMinutes: number | null;
}

export interface VollnaData {
  proposals: Proposal[];
  connectsBalance: number | null;
  lastSyncAt: string | null;
  /** Vollna's API, or the "Upwork proposals" tab exported from their website by hand. */
  from: 'api' | 'sheet';
}

export interface StripeBalance { availableCents: number; pendingCents: number; currency: string }

export interface Blob {
  generatedAt: string;
  config: DashConfig;
  ledger: Source<LedgerRow[]>;
  recurring: Source<RecurringRow[]>;
  runs: Source<RunRow[]>;
  stageLog: Source<StageEvent[]>;
  notes: Source<NoteRow[]>;
  cards: Source<Card[]>;
  bookings: Source<Booking[]>;
  instantly: Source<InstantlyData>;
  vollna: Source<VollnaData>;
  stripe: Source<StripeBalance>;
  retro: Source<RetroData>;
}

/* ---------------------------------------------------------------- retrospectives */

/** One day of the retrospective sheet's Daily tab. Missing numbers are absent, not zero. */
export interface RetroDay {
  date: string;
  uw_apps?: number; uw_viewed?: number; uw_replied?: number; uw_offers?: number; uw_hired?: number;
  em_sent?: number; em_replies?: number; em_positive?: number; em_meetings?: number; em_signed?: number; em_bounced?: number;
  li_posts?: number; li_impressions?: number; li_measured?: number; li_new_connections?: number;
  li_followers?: number; li_connections?: number;
}

export type RetroKind = 'num' | 'dec' | 'pct' | 'pct2';
export interface RetroNumber { label: string; now: number | null; prev: number | null; all: number | null; kind: RetroKind; lower_better: boolean }
export interface RetroStep { step: string; count: number; rate?: number | null; prev_rate?: number | null; normal_rate?: number | null; broken: boolean }
export interface RetroPoint { what: string; evidence: string }
export interface RetroLearning { rule: string; evidence: string; status: 'working' | 'testing' | 'not working' | 'dropped' }
export interface RetroChannel {
  name: string;
  verdict?: string;                 // one line: keep going, change, or stop, and why
  breaks?: string;
  broken_step?: string;
  sample_note?: string;
  keep?: RetroPoint[]; change?: RetroPoint[]; stop?: RetroPoint[];
  diagnosis?: { stage: string; says: string; fix: string }[];
  top?: { label: string; value: string; note?: string }[];   // best and worst items, e.g. posts
  learnings?: RetroLearning[];
  last_change?: string; last_verdict?: { done?: string; worked?: string };
  next_change?: string; measure?: string;
  numbers: RetroNumber[];
  funnel: RetroStep[];
}
export interface RetroRecord {
  date: string; start: string; end: string; prev_start?: string; prev_end?: string;
  summary: string[];
  changes: { channel: string; change: string; measure?: string }[];
  channels: RetroChannel[];
}
export interface RetroData { days: RetroDay[]; retros: RetroRecord[] }
