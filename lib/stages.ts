/**
 * The five stages every pipeline is read into. A CRM can call its columns
 * whatever it likes; `stageOf` reads the name and picks the matching stage.
 */
export type Stage = 'intake' | 'meeting booked' | 'proposal sent' | 'closed won' | 'closed lost';
export const STAGES: Stage[] = ['intake', 'meeting booked', 'proposal sent', 'closed won', 'closed lost'];
export const STAGE_TITLE: Record<Stage, string> = {
  intake: 'Intake', 'meeting booked': 'Meeting booked', 'proposal sent': 'Proposal sent', 'closed won': 'Closed won', 'closed lost': 'Closed lost',
};

/** "Discovery call booked" is a meeting, "Won 🎉" is closed won, anything unknown is intake. */
export function stageOf(name: string): Stage {
  const s = (name ?? '').toLowerCase();
  if (!s) return 'intake';
  if ((STAGES as string[]).includes(s)) return s as Stage;
  if (/\blost\b|declined|no deal|dead|churn/.test(s)) return 'closed lost';
  if (/\bwon\b|signed|paid|client|closed$/.test(s)) return 'closed won';
  if (/proposal|quote|offer sent|pitched/.test(s)) return 'proposal sent';
  if (/meeting|call|booked|discovery|demo|interview|conversation/.test(s)) return 'meeting booked';
  return 'intake';
}

/**
 * A card's Source ("Upwork", "Referral from Ana", "LinkedIn DM") mapped onto
 * the business's own channel list. Exact or leading match first, then a few
 * words everyone uses, then the catch all channel if there is one.
 */
export function channelOf(source: string, channels: string[]): string {
  const s = (source ?? '').toLowerCase().trim();
  const found = channels.find((c) => s === c.toLowerCase()) ?? channels.find((c) => s.startsWith(c.toLowerCase()) || c.toLowerCase().startsWith(s) && s.length >= 4);
  if (found) return found;
  const pick = (...names: string[]) => channels.find((c) => names.includes(c.toLowerCase()));
  if (/referr|communit|linkedin|network|friend|partner|word of mouth/.test(s)) return pick('network', 'referral', 'referrals', 'community') ?? channels[0] ?? 'Other';
  if (/site|inbound|seo|google|organic|form/.test(s)) return pick('website', 'inbound') ?? channels[0] ?? 'Other';
  if (/email|instantly|outreach/.test(s)) return pick('cold email', 'email', 'outreach') ?? channels[0] ?? 'Other';
  if (/upwork|fiverr|freelanc|marketplace/.test(s)) return pick('upwork', 'marketplaces', 'fiverr') ?? channels[0] ?? 'Other';
  return pick('network', 'other') ?? channels[0] ?? 'Other';
}
