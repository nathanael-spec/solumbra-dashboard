/**
 * When a pipeline card reaches "closed won", open a card for that client in a
 * separate Clients list (CLICKUP_CLIENTS_LIST_ID), in that list's first status.
 *
 * Fields are found by NAME in the Clients list, so nothing here is tied to one
 * workspace. Whatever the Clients list has of these is filled, the rest skipped:
 *   Related Deal (relationship)  -> the won pipeline card
 *   Rate (money)                 <- the deal card's "Deal value"
 *   Project Type (dropdown)      <- the deal card's "Service" (same option names)
 *   Company, Email               <- copied when the deal card has them
 * The card is named after the person (the deal card's name), like the CRM.
 * A deal that already has a client card is never copied twice.
 *
 * ONE CARD PER CLIENT (2026-11-25). A client is a business, a deal is one
 * project. When the won deal's Company (or Email) already has a client card,
 * no new card is made: the deal is added to that card's Related Deal, the deal
 * is marked "Repeat client", Rate and Project Type move to the new project,
 * and a "complete" card goes back to "onboarding". A "recurring" card stays.
 */
const API = 'https://api.clickup.com/api/v2';

interface Field { id: string; name: string; type: string; value?: unknown; type_config?: { options?: { id: string; name: string; orderindex?: number }[] } }
interface Task { id: string; name: string; url?: string; custom_fields?: Field[] }

async function cu<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: process.env.CLICKUP_API_TOKEN ?? '', 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ClickUp ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function optionName(f: Field | undefined): string {
  if (!f || f.value === undefined || f.value === null) return '';
  const opts = f.type_config?.options ?? [];
  const o = opts.find((x) => x.id === f.value) ?? opts.find((x) => x.orderindex === Number(f.value));
  return o?.name ?? '';
}

async function clientCards(listId: string): Promise<Task[]> {
  const out: Task[] = [];
  for (let page = 0; page < 10; page++) {
    const r = await cu<{ tasks: Task[]; last_page?: boolean }>(`/list/${listId}/task?include_closed=true&subtasks=true&page=${page}`);
    out.push(...r.tasks);
    if (r.last_page !== false) break;
  }
  return out;
}

const valueOf = (t: Task, name: string): string => {
  const v = t.custom_fields?.find((f) => norm(f.name) === norm(name))?.value;
  return typeof v === 'string' ? v : '';
};

/** A business name with case, punctuation and legal endings (LLC, Inc, Co...) taken off. */
export function companyKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter((w) => w && !['llc', 'inc', 'co', 'ltd', 'corp', 'company', 'the'].includes(w)).join('');
}

/**
 * The existing client card for this business, so spelling does not have to be exact.
 * Tried in order, first hit wins:
 *   1. same Company once case, punctuation and LLC/Inc are ignored
 *   2. same Email
 *   3. one Company contains the other ("GALO Built" inside "GALO Masonry Inc (GALO Built)"),
 *      only when exactly one card matches
 *   4. same person name as the card, only when exactly one card matches
 */
export function sameClient(cards: Task[], company: string, email: string, person = ''): Task | undefined {
  const c = companyKey(company);
  const e = email.trim().toLowerCase();
  const only = (hits: Task[]) => (hits.length === 1 ? hits[0] : undefined);
  if (c) {
    const exact = cards.find((t) => companyKey(valueOf(t, 'Company')) === c);
    if (exact) return exact;
  }
  if (e) {
    const byMail = cards.find((t) => valueOf(t, 'Email').trim().toLowerCase() === e);
    if (byMail) return byMail;
  }
  if (c.length >= 4) {
    const inside = only(cards.filter((t) => {
      const k = companyKey(valueOf(t, 'Company'));
      return k.length >= 4 && (k.includes(c) || c.includes(k));
    }));
    if (inside) return inside;
  }
  const p = norm(person);
  return p.length >= 5 ? only(cards.filter((t) => norm(t.name) === p)) : undefined;
}

export async function openClientCard(dealId: string): Promise<string> {
  const listId = process.env.CLICKUP_CLIENTS_LIST_ID ?? '';
  if (!listId) return 'no clients list set';

  const fields = (await cu<{ fields: Field[] }>(`/list/${listId}/field`)).fields;
  const byName = (n: string) => fields.find((f) => norm(f.name) === norm(n));
  const rel = byName('Related Deal');
  const cards = await clientCards(listId);
  const linkedTo = (t: Task) => {
    const v = t.custom_fields?.find((f) => f.id === rel?.id)?.value;
    return Array.isArray(v) ? (v as { id: string }[]) : [];
  };
  // Already linked: either the card this deal opened itself (one deal, nothing to do), or he
  // made the deal from the client card's Related Deal box (the card has other deals: a repeat).
  const linked = cards.find((t) => linkedTo(t).some((x) => x.id === dealId));
  if (linked && linkedTo(linked).length < 2) return 'client card already exists';

  const deal = await cu<Task>(`/task/${dealId}`);
  const dealField = (n: string) => deal.custom_fields?.find((f) => norm(f.name) === norm(n));
  const str = (n: string) => { const v = dealField(n)?.value; return typeof v === 'string' ? v : ''; };

  const custom: { id: string; value: unknown }[] = [];
  const rate = byName('Rate');
  const value = dealField('Deal value')?.value;
  if (rate && value !== undefined && value !== null && value !== '') custom.push({ id: rate.id, value: Number(value) });
  const type = byName('Project Type');
  const service = optionName(dealField('Service'));
  const pick = type?.type_config?.options?.find((o) => norm(o.name) === norm(service));
  if (type && pick) custom.push({ id: type.id, value: pick.id });
  for (const n of ['Company', 'Email']) {
    const target = byName(n);
    const v = dealField(n)?.value;
    if (target && v) custom.push({ id: target.id, value: v });
  }

  const existing = linked ?? sameClient(cards, str('Company'), str('Email'), deal.name);
  if (existing) {
    // Give the deal the client's exact Company when it has none or a different spelling,
    // so the P&L and the dashboard see one business.
    const companyField = dealField('Company');
    const clientCompany = valueOf(existing, 'Company');
    if (companyField && clientCompany && str('Company') !== clientCompany) {
      await cu(`/task/${dealId}/field/${companyField.id}`, { method: 'POST', body: JSON.stringify({ value: clientCompany }) });
    }
    // A second (or third) project for a client we already have: join, never copy.
    if (rel && !linked) custom.push({ id: rel.id, value: { add: [dealId], rem: [] } });
    for (const c of custom) {
      if (['Company', 'Email'].some((n) => byName(n)?.id === c.id) && valueOf(existing, fields.find((f) => f.id === c.id)!.name)) continue;
      await cu(`/task/${existing.id}/field/${c.id}`, { method: 'POST', body: JSON.stringify({ value: c.value }) });
    }
    const dealType = dealField('Deal type');
    const repeat = dealType?.type_config?.options?.find((o) => norm(o.name) === norm('Repeat client'));
    if (dealType && repeat) await cu(`/task/${dealId}/field/${dealType.id}`, { method: 'POST', body: JSON.stringify({ value: repeat.id }) });
    const status = (existing as Task & { status?: { status?: string } }).status?.status ?? '';
    if (status === 'complete') await cu(`/task/${existing.id}`, { method: 'PUT', body: JSON.stringify({ status: 'onboarding' }) });
    return `joined client card ${existing.id}`;
  }

  const created = await cu<Task>(`/list/${listId}/task`, {
    method: 'POST',
    // Card name is the person (the deal card's name); the business goes in Company.
    body: JSON.stringify({ name: deal.name, description: `Won deal: ${deal.name}${deal.url ? ` (${deal.url})` : ''}` }),
  });
  // Written one by one: the create call silently drops dropdown values.
  if (rel) custom.push({ id: rel.id, value: { add: [dealId], rem: [] } });
  for (const c of custom) {
    await cu(`/task/${created.id}/field/${c.id}`, { method: 'POST', body: JSON.stringify({ value: c.value }) });
  }
  return `client card ${created.id}`;
}
