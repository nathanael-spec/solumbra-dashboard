/** Stripe balance only. Money lives in the P&L sheet, this is just what Stripe holds right now. */
import type { StripeBalance } from '../types';
import { env, getJson } from './util';

export async function readStripeBalance(): Promise<StripeBalance> {
  const body = await getJson<{ available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] }>(
    'https://api.stripe.com/v1/balance',
    { Authorization: `Bearer ${env('STRIPE_API_KEY')}` },
  );
  const usd = (xs: { amount: number; currency: string }[]) => xs.filter((x) => x.currency === 'usd').reduce((s, x) => s + x.amount, 0);
  return { availableCents: usd(body.available), pendingCents: usd(body.pending), currency: 'usd' };
}
