import { describe, expect, it } from 'vitest';
import { retroSeries, bucketFor } from '../lib/retro';
import { parseDaily } from '../lib/sources/retro';

describe('retro', () => {
  it('reads the Daily tab by heading', () => {
    const days = parseDaily([['Date', 'Upwork apps sent', 'Followers (total that day)'], ['2026-11-02', 10, ''], ['2026-11-01', '3', 500]]);
    expect(days).toEqual([{ date: '2026-11-01', uw_apps: 3, li_followers: 500 }, { date: '2026-11-02', uw_apps: 10 }]);
  });

  it('picks day, week or month from the length of the range', () => {
    expect(bucketFor('2026-11-01', '2026-11-14')).toBe('day');
    expect(bucketFor('2026-08-01', '2026-11-14')).toBe('week');
    expect(bucketFor('2026-01-01', '2026-11-14')).toBe('month');
  });

  it('sums by week, keeps empty weeks and carries followers forward', () => {
    const rows = retroSeries([
      { date: '2026-10-28', li_followers: 400 },
      { date: '2026-11-02', uw_apps: 10, uw_viewed: 2, li_impressions: 300, li_measured: 1 },
      { date: '2026-11-04', uw_apps: 10, uw_viewed: 3, li_followers: 420 },
      { date: '2026-11-17', uw_apps: 5 },
    ], '2026-11-02', '2026-11-22', 'week');
    expect(rows.map((r) => r.start)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(rows[0]).toMatchObject({ apps: 20, viewed: 5, viewRate: 25, followers: 420, perPost: 300 });
    expect(rows[1]).toMatchObject({ apps: 0, viewRate: null, followers: 420 });
    expect(rows[2].apps).toBe(5);
  });
});
