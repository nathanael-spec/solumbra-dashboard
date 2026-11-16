/**
 * When the last step of a client's delivery checklist is closed, move that
 * client's card in the Clients list (CLICKUP_CLIENTS_LIST_ID) forward:
 *   - a recurring client goes to "recurring" (never "complete"),
 *   - every other client goes to "complete".
 * A client counts as recurring when its card is already in "recurring", or its
 * Project Type is one of RECURRING_TYPES (work that is paid every month).
 *
 * The client card is found two ways, first match wins:
 *   1. the "Client" task link on any card in the delivery list,
 *   2. the client card whose "Delivery checklist" link points at this list.
 * A card already in "complete" is never touched.
 */
const API = 'https://api.clickup.com/api/v2';
const RECURRING_TYPES = ['email + sms (klaviyo)'];

interface Field { id: string; name: string; type: string; value?: unknown; type_config?: { options?: { id: string; name: string; orderindex?: number }[] } }
interface Status { status: string; type: string }
interface Task { id: string; name: string; status: Status; list: { id: string }; folder?: { id: string; name?: string }; custom_fields?: Field[] }

async function cu<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: process.env.CLICKUP_API_TOKEN ?? '', 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ClickUp ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]/g, '');
const finished = (s: Status) => s.type === 'closed' || s.type === 'done';

async function allTasks(listId: string): Promise<Task[]> {
  const out: Task[] = [];
  for (let page = 0; page < 20; page++) {
    const r = await cu<{ tasks: Task[]; last_page?: boolean }>(`/list/${listId}/task?include_closed=true&subtasks=true&page=${page}`);
    out.push(...r.tasks);
    if (r.last_page !== false) break;
  }
  return out;
}

function optionName(f: Field | undefined): string {
  if (!f || f.value === undefined || f.value === null) return '';
  const opts = f.type_config?.options ?? [];
  const o = opts.find((x) => x.id === f.value) ?? opts.find((x) => x.orderindex === Number(f.value));
  return o?.name ?? '';
}

export async function closeClientIfDelivered(taskId: string): Promise<string> {
  const clientsList = process.env.CLICKUP_CLIENTS_LIST_ID ?? '';
  if (!clientsList) return 'no clients list set';

  const task = await cu<Task>(`/task/${taskId}`);
  if (!finished(task.status)) return 'step not finished';
  if (task.folder?.name && !/delivery\s*·?\s*active/i.test(task.folder.name)) return `not in Delivery · Active (${task.folder.name})`;

  const steps = await allTasks(task.list.id);
  const open = steps.filter((t) => !finished(t.status));
  if (open.length) return `${open.length} steps still open`;

  // 1. the Client link on any delivery card
  let clientId = '';
  for (const t of steps) {
    const f = t.custom_fields?.find((x) => norm(x.name) === 'client');
    const linked = Array.isArray(f?.value) ? (f!.value as { id: string }[]) : [];
    const hit = linked.find((x) => x.id);
    if (hit) { clientId = hit.id; break; }
  }
  // 2. the client card whose Delivery checklist points at this list
  if (!clientId) {
    const cards = await allTasks(clientsList);
    const hit = cards.find((c) => {
      const url = String(c.custom_fields?.find((x) => norm(x.name) === 'deliverychecklist')?.value ?? '');
      return url.includes(task.list.id);
    });
    if (hit) clientId = hit.id;
  }
  if (!clientId) return 'no client card found for this delivery list';

  const client = await cu<Task>(`/task/${clientId}`);
  if (client.list.id !== clientsList) return `linked card ${clientId} is not in the Clients list`;
  const now = client.status.status.toLowerCase();
  if (now === 'complete' || client.status.type === 'closed') return 'client card already complete';

  const type = norm(optionName(client.custom_fields?.find((x) => norm(x.name) === 'projecttype')));
  const recurring = now === 'recurring' || RECURRING_TYPES.some((r) => norm(r) === type);
  const target = recurring ? 'recurring' : 'complete';
  if (now === target) return `client card already ${target}`;

  await cu(`/task/${clientId}`, { method: 'PUT', body: JSON.stringify({ status: target }) });
  return `client card ${client.name} moved to ${target}`;
}
