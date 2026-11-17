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

async function alreadyHasClient(listId: string, dealId: string, relId: string | undefined): Promise<boolean> {
  for (let page = 0; page < 10; page++) {
    const r = await cu<{ tasks: Task[]; last_page?: boolean }>(`/list/${listId}/task?include_closed=true&subtasks=true&page=${page}`);
    for (const t of r.tasks) {
      const rel = t.custom_fields?.find((f) => f.id === relId);
      const linked = Array.isArray(rel?.value) ? (rel!.value as { id: string }[]) : [];
      if (linked.some((x) => x.id === dealId)) return true;
    }
    if (r.last_page !== false) break;
  }
  return false;
}

export async function openClientCard(dealId: string): Promise<string> {
  const listId = process.env.CLICKUP_CLIENTS_LIST_ID ?? '';
  if (!listId) return 'no clients list set';

  const fields = (await cu<{ fields: Field[] }>(`/list/${listId}/field`)).fields;
  const byName = (n: string) => fields.find((f) => norm(f.name) === norm(n));
  const rel = byName('Related Deal');
  if (await alreadyHasClient(listId, dealId, rel?.id)) return 'client card already exists';

  const deal = await cu<Task>(`/task/${dealId}`);
  const dealField = (n: string) => deal.custom_fields?.find((f) => norm(f.name) === norm(n));

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
