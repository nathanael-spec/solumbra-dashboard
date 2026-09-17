/**
 * The pipeline kept in a Google Sheet, for anyone without a CRM. One row per
 * lead on a tab called Pipeline. Columns are found by heading:
 *
 *   Name | Company | Stage | Source | Deal value | Due date | Link |
 *   Meeting booked on | Proposal sent on | Closed on | Created on | Notes
 *
 * Stage is free text, read by `stageOf`. The three date columns are what the
 * funnel counts, so a row that says "closed won" with no "Closed on" date is
 * a card on the board but not a deal in any period. Fill the dates in.
 */
import type { Card, StageEvent } from '../types';
import { stageOf } from '../stages';
import { dashboardSheetId, readRanges, sheetDate } from './sheets';
import { num } from './util';

export const PIPELINE_HEADINGS = ['Name', 'Company', 'Stage', 'Source', 'Deal value', 'Due date', 'Link', 'Meeting booked on', 'Proposal sent on', 'Closed on', 'Created on', 'Notes'];

export function parsePipeline(rows: string[][]): { cards: Card[]; events: StageEvent[] } {
  const head = (rows[0] ?? []).map((h) => String(h).trim().toLowerCase());
  const col = (...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = {
    name: col('name', 'who', 'lead'), company: col('company'), stage: col('stage', 'status'), source: col('source', 'channel'),
    value: col('deal value', 'value', 'amount'), due: col('due date', 'due', 'follow up'), link: col('link', 'url'),
    meeting: col('meeting booked on', 'meeting booked', 'meeting'), proposal: col('proposal sent on', 'proposal sent', 'proposal'),
    closed: col('closed on', 'closed', 'won on'), created: col('created on', 'created', 'added'), notes: col('notes', 'note'),
  };
  const cell = (r: string[], i: number) => (i < 0 ? '' : String(r[i] ?? '').trim());
  const day = (r: string[], i: number) => { const v = i < 0 ? '' : r[i]; return v === '' || v === undefined || v === null ? '' : sheetDate(v); };
  const cards: Card[] = [];
  const events: StageEvent[] = [];
  rows.slice(1).forEach((r, i) => {
    const name = cell(r, c.name);
    if (!name) return;
    const id = `sheet-${i + 2}`;
    const status = stageOf(cell(r, c.stage));
    const created = day(r, c.created) || day(r, c.meeting) || '';
    const value = cell(r, c.value);
    cards.push({
      id, name, status, rawStatus: cell(r, c.stage), url: cell(r, c.link),
      dateCreated: created ? `${created}T12:00:00Z` : '', dateUpdated: '', dateClosed: day(r, c.closed) ? `${day(r, c.closed)}T12:00:00Z` : null,
      dueDate: day(r, c.due) ? `${day(r, c.due)}T12:00:00Z` : null,
      company: cell(r, c.company), dealValue: value === '' ? null : num(value), source: cell(r, c.source),
      offer: '', niche: '', proposalLink: '', meetingLink: '',
    });
    const push = (to: string, d: string, from = '') => { if (d) events.push({ at: `${d}T12:00:00Z`, taskId: id, task: name, from, to, how: 'sheet' }); };
    push('intake', created);
    push('meeting booked', day(r, c.meeting), 'intake');
    push('proposal sent', day(r, c.proposal), 'meeting booked');
    if (status === 'closed won' || status === 'closed lost') push(status, day(r, c.closed), 'proposal sent');
  });
  return { cards, events };
}

export async function readPipelineSheet(): Promise<{ cards: Card[]; events: StageEvent[] }> {
  const got = await readRanges(dashboardSheetId(), ['Pipeline!A1:L2000']);
  return parsePipeline(got['Pipeline!A1:L2000']);
}
