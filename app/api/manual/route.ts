import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { appendRows, logStageChange } from '@/lib/sources/sheets';
import { BLOB_TAG } from '@/lib/cache/blob';
import { readConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

const STAGE: Record<string, string> = { meeting: 'meeting booked', proposal: 'proposal sent', deal: 'closed won' };

interface Body { kind?: string; date?: string; who?: string; amount?: number | null; source?: string; channel?: string; category?: string; howPaid?: string; note?: string }

const clean = (v: unknown, max = 200): string => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

export async function POST(request: Request): Promise<NextResponse> {
  let b: Body;
  try {
    b = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }
  const config = readConfig();
  if (config.demo) return NextResponse.json({ ok: false, error: 'Demo mode saves nothing. Run npm run setup to connect your own sheet.' }, { status: 400 });
  const CHANNELS = config.channels;
  const CATEGORIES = config.categories;
  const kind = clean(b.kind);
  const date = clean(b.date, 10);
  const who = clean(b.who);
  const note = clean(b.note, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: 'The date is missing.' }, { status: 400 });
  if (!who) return NextResponse.json({ ok: false, error: 'Say who it was.' }, { status: 400 });
  const stamp = Date.now();

  try {
    if (kind === 'cash') {
      const amount = Number(b.amount);
      if (!(amount > 0)) return NextResponse.json({ ok: false, error: 'The amount has to be above zero.' }, { status: 400 });
      const channel = CHANNELS.includes(clean(b.channel)) ? clean(b.channel) : CHANNELS[0] ?? 'Other';
      const category = CATEGORIES.includes(clean(b.category)) ? clean(b.category) : CATEGORIES[CATEGORIES.length - 1] ?? 'Other';
      const howPaid = clean(b.howPaid) || 'Other';
      // Date | In or Out | Channel | Category | Who | Amount | How paid | Status | Notes | Source id
      await appendRows(process.env.PNL_SHEET_ID ?? '', 'Ledger!A1', [[
        date, 'In', channel, category, who, amount, howPaid, 'Received',
        (note ? note + '. ' : '') + 'Added by hand from the dashboard.', `dashboard:${stamp}`,
      ]]);
      revalidateTag(BLOB_TAG);
      return NextResponse.json({ ok: true, wrote: `Saved. $${amount} from ${who} is now in the Ledger under ${channel}.` });
    }
    const to = STAGE[kind];
    if (!to) return NextResponse.json({ ok: false, error: 'Pick what happened.' }, { status: 400 });
    const source = clean(b.source) || 'Other';
    const amount = kind === 'deal' && Number(b.amount) > 0 ? Number(b.amount) : null;
    const how = ['manual', `source ${source}`, amount !== null ? `value ${amount}` : '', note ? `note ${note}` : ''].filter(Boolean).join(', ');
    await logStageChange({ at: `${date}T12:00:00Z`, taskId: `manual-${stamp}`, task: who, from: '', to, how });
    revalidateTag(BLOB_TAG);
    return NextResponse.json({ ok: true, wrote: `Saved. ${who}, ${to}, on ${date}.` });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
