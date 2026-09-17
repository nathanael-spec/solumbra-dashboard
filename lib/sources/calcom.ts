/** Cal.com, the booking page. Each address is pinned to a dated API version. */
import type { Booking } from '../types';
import { env, getJson } from './util';

interface RawBooking {
  id: number; uid: string; title: string; status: string; start: string; end: string; createdAt: string;
  attendees?: { name?: string; email?: string }[];
  bookingFieldsResponses?: Record<string, unknown>;
  responses?: Record<string, unknown>;
}

export async function readBookings(): Promise<Booking[]> {
  const headers = { Authorization: `Bearer ${env('CALCOM_API_KEY')}`, 'cal-api-version': '2024-08-13' };
  const out: Booking[] = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const body = await getJson<{ data: RawBooking[]; pagination?: { hasNextPage?: boolean } }>(
      `https://api.cal.com/v2/bookings?take=100&skip=${skip}`,
      headers,
    );
    for (const b of body.data ?? []) {
      const a = b.attendees?.[0] ?? {};
      const answers = { ...(b.responses ?? {}), ...(b.bookingFieldsResponses ?? {}) };
      const band = Object.entries(answers).find(([k]) => /revenue/i.test(k))?.[1];
      out.push({
        id: b.uid ?? String(b.id),
        title: b.title ?? '',
        status: (b.status ?? '').toLowerCase(),
        start: b.start,
        end: b.end,
        createdAt: b.createdAt,
        name: a.name ?? '',
        email: a.email ?? '',
        revenueBand: typeof band === 'string' ? band : '',
      });
    }
    if (!body.pagination?.hasNextPage) break;
  }
  return out;
}
