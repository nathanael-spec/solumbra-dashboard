import { describe, expect, it } from 'vitest';
import { pipelineValue, upcomingCharges } from '../lib/money';
import type { Card } from '../lib/types';

describe('upcomingCharges', () => {
  it('uses "on the 5th" for the day and rolls past today', () => {
    const [c] = upcomingCharges([{ item: 'Course', what: '', monthly: 184, started: '2026-08-05', notes: 'Charges on the 5th of each month.' }], '2026-11-26');
    expect(c).toMatchObject({ due: '2026-12-05', amount: 184, every: 'month' });
  });
  it('reads a two year term and its real total', () => {
    const [c] = upcomingCharges([{ item: 'Domain', what: '', monthly: 6.38, started: '2026-07-29', notes: '153.00 covers two years, so the monthly share is 153 divided by 24.' }], '2026-11-26');
    expect(c).toMatchObject({ due: '2028-07-29', amount: 153, every: 'two years' });
  });
  it('leaves cancelled rows out and clamps the day to short months', () => {
    const got = upcomingCharges([
      { item: 'Gone', what: '', monthly: 0, started: '2026-08-15' },
      { item: 'Late', what: '', monthly: 10, started: '2026-01-31' },
    ], '2027-02-01');
    expect(got.map((c) => [c.item, c.due])).toEqual([['Late', '2027-02-28']]);
  });
});

describe('pipelineValue', () => {
  it('adds Deal value per stage and counts cards with none', () => {
    const card = (status: string, dealValue: number | null) => ({ status, dealValue } as Card);
    const got = pipelineValue([card('intake', 500), card('intake', null), card('closed won', 900)]);
    expect(got.find((s) => s.stage === 'intake')).toMatchObject({ cards: 2, value: 500, unpriced: 1 });
    expect(got.find((s) => s.stage === 'closed won')).toMatchObject({ cards: 1, value: 900 });
  });
});
