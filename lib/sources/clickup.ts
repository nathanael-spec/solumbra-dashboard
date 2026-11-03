/**
 * ClickUp, the pipeline. Header is the bare token, no Bearer. v2 only.
 * The free plan keeps no status history, which is why stage changes are
 * written to the Stage log tab by the webhook in app/api/hooks/clickup.
 *
 * Statuses can be named anything; `stageOf` reads them into the five stages.
 * Custom fields are found by a loose name match, so "Deal value", "Value" and
 * "Amount" all work.
 *
 * A ClickUp Workspace on the free plan is allowed 60 Custom Field values in
 * total, counted once for every value ever set. Past that, ClickUp refuses
 * every write, including clearing a value to make room, so the Deal value
 * field can no longer be filled in. The agreed way round it is to put the
 * amount at the front of the card name, "$300 · Someone, Their Business", and
 * `splitNameValue` reads it back out. The prefix is only used when the real
 * field is empty, so nothing changes once the plan is upgraded and the field
 * works again.
 */
import type { Card } from '../types';
import { stageOf } from '../stages';
import { env, getJson, msToIso, num } from './util';

interface RawField {
  name: string;
  type: string;
  value?: unknown;
  type_config?: { options?: { id: string; name: string; orderindex?: number }[] };
}
interface RawTask {
  id: string; name: string; url: string;
  status: { status: string };
  date_created: string; date_updated: string; date_closed: string | null; due_date: string | null;
  custom_fields: RawField[];
}

const FIELDS: Record<string, string[]> = {
  dealValue: ['deal value', 'value', 'amount', 'deal size', 'price'],
  company: ['company', 'business', 'organization', 'organisation'],
  source: ['source', 'channel', 'where from', 'lead source'],
  offer: ['offer', 'service', 'product'],
  niche: ['niche', 'industry', 'segment'],
  proposalLink: ['proposal link', 'proposal'],
  meetingLink: ['meeting link', 'meeting', 'call link'],
};

function fieldText(fields: RawField[], names: string[]): string {
  const f = names.map((n) => fields.find((x) => x.name.trim().toLowerCase() === n)).find(Boolean);
  if (!f || f.value === null || f.value === undefined || f.value === '') return '';
  if (f.type === 'drop_down') {
    const options = f.type_config?.options ?? [];
    const v = f.value;
    const hit = options.find((o) => o.orderindex === v) ?? options.find((o) => o.id === v) ?? (typeof v === 'number' ? options[v] : undefined);
    return hit?.name ?? '';
  }
  if (f.type === 'labels' && Array.isArray(f.value)) {
    const options = f.type_config?.options ?? [];
    return (f.value as string[]).map((id) => options.find((o) => o.id === id)?.name ?? '').filter(Boolean).join(', ');
  }
  return String(f.value);
}

/**
 * Reads a "$300 · Name" prefix off the front of a card name. Returns the name
 * without the prefix, and the amount, or null when there is no prefix. Written
 * as its own function so the workaround is easy to find and delete later.
 */
export function splitNameValue(raw: string): { name: string; value: number | null } {
  const m = /^\$\s*(\d[\d,]*(?:\.\d+)?)\s*[·•]\s*(.+)$/.exec(raw.trim());
  if (!m) return { name: raw, value: null };
  const value = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return { name: raw, value: null };
  return { name: m[2].trim(), value };
}

export async function readCards(): Promise<Card[]> {
  const headers = { Authorization: env('CLICKUP_API_TOKEN') };
  const list = env('CLICKUP_LIST_ID');
  const cards: Card[] = [];
  for (let page = 0; page < 10; page++) {
    const body = await getJson<{ tasks: RawTask[]; last_page: boolean }>(
      `https://api.clickup.com/api/v2/list/${list}/task?include_closed=true&subtasks=false&page=${page}`,
      headers,
    );
    for (const t of body.tasks) {
      const f = t.custom_fields ?? [];
      const deal = fieldText(f, FIELDS.dealValue);
      const named = splitNameValue(t.name);
      cards.push({
        id: t.id,
        name: named.name,
        status: stageOf(t.status.status),
        rawStatus: t.status.status,
        url: t.url,
        dateCreated: msToIso(t.date_created) ?? '',
        dateUpdated: msToIso(t.date_updated) ?? '',
        dateClosed: msToIso(t.date_closed),
        dueDate: msToIso(t.due_date),
        company: fieldText(f, FIELDS.company),
        dealValue: deal === '' ? named.value : num(deal),
        source: fieldText(f, FIELDS.source),
        offer: fieldText(f, FIELDS.offer),
        niche: fieldText(f, FIELDS.niche),
        proposalLink: fieldText(f, FIELDS.proposalLink),
        meetingLink: fieldText(f, FIELDS.meetingLink),
      });
    }
    if (body.last_page !== false) break;
  }
  return cards;
}
