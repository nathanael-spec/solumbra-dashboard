/**
 * ClickUp calls this address when a pipeline card changes. The stage change
 * is written to the Stage log tab of the dashboard sheet, because the free
 * plan keeps no history of its own. The message is signed with the webhook
 * secret, and an unsigned or wrongly signed message is ignored.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { logStageChange } from '@/lib/sources/sheets';
import { BLOB_TAG } from '@/lib/cache/blob';
import { stageOf } from '@/lib/stages';
import { fillRepeatDeal, openClientCard } from '@/lib/sources/clientHandoff';

export const dynamic = 'force-dynamic';

interface HistoryItem { field?: string; before?: { status?: string } | string | null; after?: { status?: string } | string | null; date?: string }
interface Payload { event?: string; task_id?: string; history_items?: HistoryItem[] }

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const statusOf = (v: HistoryItem['before']): string => { const raw = (typeof v === 'string' ? v : v?.status ?? '').toLowerCase(); return raw ? stageOf(raw) : ''; };

async function taskName(id: string): Promise<string> {
  try {
    const res = await fetch(`https://api.clickup.com/api/v2/task/${id}`, { headers: { Authorization: process.env.CLICKUP_API_TOKEN ?? '' }, cache: 'no-store' });
    if (!res.ok) return id;
    const t = (await res.json()) as { name?: string; status?: { status?: string } };
    return t.name ?? id;
  } catch {
    return id;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET ?? '';
  const raw = await request.text();
  const given = request.headers.get('x-signature') ?? '';
  if (!secret || !same(given, await hmacHex(secret, raw))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = JSON.parse(raw) as Payload;
  } catch {
    return NextResponse.json({ error: 'bad body' }, { status: 400 });
  }
  const id = payload.task_id ?? '';
  if (!id) return NextResponse.json({ ok: true, ignored: 'no task' });

  const changes: { from: string; to: string; at: string }[] = [];
  if (payload.event === 'taskStatusUpdated') {
    for (const h of payload.history_items ?? []) {
      if (h.field && h.field !== 'status') continue;
      const to = statusOf(h.after);
      if (!to) continue;
      const at = h.date ? new Date(Number(h.date)).toISOString() : new Date().toISOString();
      changes.push({ from: statusOf(h.before), to, at });
    }
  } else if (payload.event === 'taskCreated') {
    const to = statusOf(payload.history_items?.find((h) => h.field === 'status')?.after) || 'intake';
    changes.push({ from: '', to, at: new Date().toISOString() });
  }
  if (!changes.length) return NextResponse.json({ ok: true, ignored: payload.event });

  const name = await taskName(id);
  for (const c of changes) {
    await logStageChange({ at: c.at, taskId: id, task: name, from: c.from, to: c.to, how: 'webhook' });
  }
  revalidateTag(BLOB_TAG);

  // A repeat deal gets the business facts (Website, Email, Niche...) from the client's earlier deal.
  let filled = '';
  try {
    filled = await fillRepeatDeal(id);
  } catch (e) {
    filled = `fill failed: ${(e as Error).message}`;
    console.error(filled);
  }

  let client = '';
  if (changes.some((c) => c.to === 'closed won' && c.from !== 'closed won')) {
    try {
      client = await openClientCard(id);
    } catch (e) {
      client = `client card failed: ${(e as Error).message}`;
      console.error(client);
    }
  }
  return NextResponse.json({ ok: true, logged: changes.length, filled, client });
}
