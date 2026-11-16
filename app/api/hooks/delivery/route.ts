/**
 * ClickUp calls this address when a step in the Delivery · Active folder
 * changes status. When the whole checklist is done, the client's card in the
 * Clients list moves to "complete" (or "recurring"); see lib/sources/deliveryDone.ts.
 * Signed with its own webhook secret, CLICKUP_DELIVERY_WEBHOOK_SECRET.
 */
import { NextResponse } from 'next/server';
import { closeClientIfDelivered } from '@/lib/sources/deliveryDone';

export const dynamic = 'force-dynamic';

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

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CLICKUP_DELIVERY_WEBHOOK_SECRET ?? '';
  const raw = await request.text();
  const given = request.headers.get('x-signature') ?? '';
  if (!secret || !same(given, await hmacHex(secret, raw))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }
  let payload: { event?: string; task_id?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'bad body' }, { status: 400 });
  }
  if (payload.event !== 'taskStatusUpdated' || !payload.task_id) return NextResponse.json({ ok: true, ignored: payload.event });

  let result = '';
  try {
    result = await closeClientIfDelivered(payload.task_id);
  } catch (e) {
    result = `failed: ${(e as Error).message}`;
    console.error(result);
  }
  return NextResponse.json({ ok: true, result });
}
