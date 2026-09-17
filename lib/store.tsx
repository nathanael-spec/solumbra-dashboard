'use client';

/**
 * One fetch, one blob, held on the client. Filtering by period never asks the
 * server again, which is what makes the picker instant.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Blob, DashConfig } from './types';
import { makePeriod, PERIOD_KEYS, type Period, type PeriodKey } from './period';
import { setCurrency } from './format';

interface Store {
  blob: Blob | null;
  loading: boolean;
  error: string | null;
  period: Period;
  custom: { start: string; end: string };
  setPeriod: (k: PeriodKey, custom?: { start: string; end: string }) => void;
  refresh: () => Promise<void>;
  today: string;
  nowIso: string;
  config: DashConfig | null;
}

const Ctx = createContext<Store | null>(null);

/** Today in the business's timezone as YYYY-MM-DD. Before the config arrives, the browser's zone. */
export function todayIn(zone?: string | null, d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<PeriodKey>('month');
  const [custom, setCustom] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [today, setToday] = useState(todayIn());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dash.period') as PeriodKey | null;
      if (saved && PERIOD_KEYS.includes(saved)) setKey(saved);
      const range = localStorage.getItem('dash.custom');
      if (range) setCustom(JSON.parse(range) as { start: string; end: string });
    } catch { /* private window, fine */ }
  }, []);

  const load = useCallback(async (fresh: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data${fresh ? '?fresh=1' : ''}`, { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`The data route answered ${res.status}.`);
      const next = (await res.json()) as Blob;
      setCurrency(next.config.currency);
      setBlob(next);
      setError(null);
      setToday(todayIn(next.config.timezone));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);
  // A page left open for a day should still be today's page.
  useEffect(() => {
    const t = setInterval(() => void load(false), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const setPeriod = useCallback((k: PeriodKey, range?: { start: string; end: string }) => {
    setKey(k);
    if (range) setCustom(range);
    try {
      localStorage.setItem('dash.period', k);
      if (range) localStorage.setItem('dash.custom', JSON.stringify(range));
    } catch { /* fine */ }
  }, []);

  const value = useMemo<Store>(() => ({
    blob, loading, error,
    period: makePeriod(key, today, custom.start && custom.end ? custom : undefined),
    custom,
    setPeriod,
    refresh: () => load(true),
    today,
    nowIso: new Date().toISOString(),
    config: blob?.config ?? null,
  }), [blob, loading, error, key, custom, today, setPeriod, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDash(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useDash outside DataProvider');
  return s;
}
