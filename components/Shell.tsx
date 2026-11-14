'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDash } from '@/lib/store';
import { ago } from '@/lib/format';
import { rangeLabel, type PeriodKey } from '@/lib/period';
import type { Blob } from '@/lib/types';
import { ManualEntry } from './ManualEntry';

type Need = keyof Blob['config']['connected'];
const ALL_PAGES: { href: string; label: string; needs?: Need }[] = [
  { href: '/', label: 'Today' },
  { href: '/money', label: 'Money' },
  { href: '/pipeline', label: 'Pipeline', needs: 'pipeline' },
  { href: '/cold-email', label: 'Cold email', needs: 'instantly' },
  { href: '/upwork', label: 'Upwork', needs: 'vollna' },
  { href: '/retro', label: 'Retro', needs: 'retro' },
];

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'all', label: 'All time' },
];

type SourceKey = keyof Pick<Blob, 'ledger' | 'stageLog' | 'cards' | 'bookings' | 'instantly' | 'vollna' | 'stripe' | 'retro'>;

function sourceList(blob: Blob | null): { key: SourceKey; name: string; what: string }[] {
  const pipe = blob?.config.pipeline ?? 'clickup';
  return [
    { key: 'ledger', name: 'P&L sheet', what: 'money' },
    { key: 'stageLog', name: 'Dashboard tabs', what: 'stage log, notes' },
    { key: 'cards', name: pipe === 'sheet' ? 'Pipeline tab' : 'ClickUp', what: 'pipeline' },
    { key: 'bookings', name: 'Cal.com', what: 'bookings' },
    { key: 'instantly', name: 'Instantly', what: 'cold email' },
    { key: 'vollna', name: 'Vollna', what: 'Upwork results' },
    { key: 'stripe', name: 'Stripe', what: 'balance' },
    { key: 'retro', name: 'Retro sheet', what: 'retrospectives' },
  ];
}

/** Every tool the page reads, and whether the last read worked. Tools never connected read as quiet, not broken. */
function Connections() {
  const { blob } = useDash();
  return (
    <div className="conn" aria-label="Connections">
      <span className="spec">Connections</span>
      {sourceList(blob).map((s) => {
        const src = blob?.[s.key];
        const ok = src?.ok ?? null;
        const isOff = Boolean(src && !src.ok && src.off);
        return (
          <div key={s.key} className={`conn-row${ok === false && !isOff ? ' bad' : ''}${isOff ? ' off' : ''}`} title={ok === false && src && !src.ok ? src.error : undefined}>
            <span><span className="dot" aria-hidden />{s.name} <span className="what">{s.what}</span></span>
            <span className="state">{ok === null ? '' : ok ? (src ? ago(src.fetchedAt) : 'ok') : isOff ? 'not connected' : 'failed'}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The logo if one is configured, otherwise the business name set in the brand type. */
function Mark({ name, logoUrl }: { name: string; logoUrl: string }) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="mark" src={logoUrl} alt={name} onError={() => setBroken(true)} />;
  }
  return <span className="wordmark" aria-label={name}>{name}</span>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { blob, loading, error, period, custom, setPeriod, refresh, today, config } = useDash();
  const [, tick] = useState(0);
  const [pick, setPick] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setFrom(custom.start || period.start);
    setTo(custom.end || period.end);
  }, [custom, period.start, period.end]);
  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPick(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick]);
  const pages = ALL_PAGES.filter((p) => !p.needs || !config || config.connected[p.needs]);
  const current = ALL_PAGES.find((p) => p.href === path) ?? ALL_PAGES[0];
  const name = config?.businessName ?? '';

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function applyCustom() {
    if (!from || !to) return;
    setPeriod('custom', { start: from, end: to });
    setPick(false);
  }

  return (
    <div className="app">
      <nav className="rail" aria-label="Pages">
        <Mark name={name} logoUrl={config?.logoUrl ?? ''} />
        {pages.map((p, i) => (
          <Link key={p.href} href={p.href} className={p.href === path ? 'current' : ''} aria-current={p.href === path ? 'page' : undefined}>
            <span>{p.label}</span>
            <span className="spec">{String(i + 1).padStart(2, '0')}</span>
          </Link>
        ))}
        {config?.proposalsUrl ? (
          <a className="away" href={config.proposalsUrl} target="_blank" rel="noreferrer noopener">
            <span>Proposals</span>
            <span className="spec" aria-hidden>&#8599;</span>
          </a>
        ) : null}
        <div className="rail-foot">
          <Connections />
          <button className="quiet-btn logout" onClick={logout}>Log out</button>
        </div>
      </nav>
      <div className="main">
        <header className="mast">
          <h1>{current.label}</h1>
          <span className="sub">
            {rangeLabel(period)}
            {blob ? `, updated ${ago(blob.generatedAt)}` : loading ? ', loading' : ''}
            {config?.demo ? '. Demo numbers, nothing here is real' : ''}
            {error ? `. ${error}` : ''}
          </span>
          <span className="grow" />
          <button className="quiet-btn" onClick={() => setAdding(true)}>Add</button>
          <div className="segment" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.key} className={period.key === p.key ? 'on' : ''} onClick={() => { setPick(false); setPeriod(p.key); }} aria-pressed={period.key === p.key}>{p.label}</button>
            ))}
            <button className={period.key === 'custom' ? 'on' : ''} onClick={() => setPick((v) => !v)} aria-pressed={period.key === 'custom'} aria-expanded={pick}>
              {period.key === 'custom' ? period.label : 'Dates'}
            </button>
          </div>
          <button className="quiet-btn" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing' : 'Refresh'}</button>
          {pick ? (
            <div className="range" role="group" aria-label="Pick dates">
              <label>From <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>To <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} /></label>
              <button className="quiet-btn" onClick={applyCustom} disabled={!from || !to}>Show</button>
              <button className="quiet-btn" onClick={() => setPick(false)}>Close</button>
            </div>
          ) : null}
        </header>
        {children}
      </div>
      {adding ? <ManualEntry onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
