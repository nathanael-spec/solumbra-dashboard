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
  { href: '/growth', label: 'Growth' },
  { href: '/money', label: 'Money' },
  { href: '/cold-email', label: 'Cold email', needs: 'instantly' },
  { href: '/upwork', label: 'Upwork', needs: 'vollna' },
  { href: '/newsletter', label: 'Newsletter', needs: 'beehiiv' },
  { href: '/retro', label: 'Retro', needs: 'retro' },
];

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'all', label: 'All time' },
];

type SourceKey = keyof Pick<Blob, 'ledger' | 'stageLog' | 'cards' | 'bookings' | 'instantly' | 'vollna' | 'stripe' | 'retro' | 'newsletter'>;

function sourceList(blob: Blob | null): { key: SourceKey; name: string; what: string }[] {
  const pipe = blob?.config.pipeline ?? 'clickup';
  return [
    { key: 'ledger', name: 'P&L sheet', what: 'money' },
    { key: 'stageLog', name: 'Dashboard tabs', what: 'stage log, notes' },
    { key: 'cards', name: pipe === 'sheet' ? 'Pipeline tab' : 'ClickUp', what: 'meetings and deals' },
    { key: 'bookings', name: 'Cal.com', what: 'bookings' },
    { key: 'instantly', name: 'Instantly', what: 'cold email' },
    { key: 'vollna', name: 'Vollna', what: 'Upwork results' },
    { key: 'stripe', name: 'Stripe', what: 'balance' },
    { key: 'retro', name: 'Retro sheet', what: 'retrospectives' },
    { key: 'newsletter', name: 'Beehiiv', what: 'newsletter' },
  ];
}

/**
 * Every tool the page reads. One line when all is well, and it opens to show
 * each tool. A tool that failed opens the list by itself, so a problem is never hidden.
 */
function Connections() {
  const { blob } = useDash();
  const rows = sourceList(blob).map((s) => {
    const src = blob?.[s.key];
    const ok = src?.ok ?? null;
    const isOff = Boolean(src && !src.ok && src.off);
    return { ...s, src, ok, isOff, failed: ok === false && !isOff };
  });
  const failed = rows.filter((r) => r.failed).length;
  const on = rows.filter((r) => r.ok).length;
  return (
    <details className={`conn${failed ? ' has-bad' : ''}`} open={failed > 0 ? true : undefined}>
      <summary>
        <span className={`dot${failed ? ' bad' : ''}`} aria-hidden />
        {!blob ? 'Reading the tools' : failed ? `${failed} ${failed === 1 ? 'tool' : 'tools'} not read` : `${on} tools connected`}
      </summary>
      {rows.map((r) => (
        <div key={r.key} className={`conn-row${r.failed ? ' bad' : ''}${r.isOff ? ' off' : ''}`} title={r.failed && r.src && !r.src.ok ? r.src.error : undefined}>
          <span>{r.name}</span>
          <span className="state">{r.ok === null ? '' : r.ok ? (r.src ? ago(r.src.fetchedAt) : 'ok') : r.isOff ? 'not connected' : 'failed'}</span>
        </div>
      ))}
    </details>
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
  // Growth always shows the whole history, so the period buttons would do nothing there.
  const usesPeriod = current.href !== '/growth';

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
        {pages.map((p) => (
          <Link key={p.href} href={p.href} className={p.href === path ? 'current' : ''} aria-current={p.href === path ? 'page' : undefined}>
            {p.label}
          </Link>
        ))}
        {config?.proposalsUrl ? (
          <a className="away" href={config.proposalsUrl} target="_blank" rel="noreferrer noopener">
            <span>Proposals</span>
            <span className="spec" aria-hidden>&#8599;</span>
          </a>
        ) : null}
        {config?.weekUrl ? (
          <a className="away" href={config.weekUrl} target="_blank" rel="noreferrer noopener">
            <span>LinkedIn week</span>
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
          <div className="mast-title">
            <h1>{current.label}</h1>
            <span className="sub">
              {usesPeriod ? rangeLabel(period) : 'Since the first row ever recorded'}
              {blob ? `. Updated ${ago(blob.generatedAt)}` : loading ? '. Loading' : ''}
              {config?.demo ? '. Demo numbers, nothing here is real' : ''}
              {error ? `. ${error}` : ''}
            </span>
          </div>
          <span className="grow" />
          {usesPeriod ? (
            <div className="segment" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button key={p.key} className={period.key === p.key ? 'on' : ''} onClick={() => { setPick(false); setPeriod(p.key); }} aria-pressed={period.key === p.key}>{p.label}</button>
              ))}
              <button className={period.key === 'custom' ? 'on' : ''} onClick={() => setPick((v) => !v)} aria-pressed={period.key === 'custom'} aria-expanded={pick}>
                {period.key === 'custom' ? period.label : 'Pick dates'}
              </button>
            </div>
          ) : null}
          <button className="quiet-btn" onClick={() => setAdding(true)}>Add</button>
          <button className="quiet-btn" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing' : 'Refresh'}</button>
          {pick && usesPeriod ? (
            <div className="range" role="group" aria-label="Pick dates">
              <label>From <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>To <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} /></label>
              <button className="quiet-btn" onClick={applyCustom} disabled={!from || !to}>Show</button>
              <button className="quiet-btn" onClick={() => setPick(false)}>Close</button>
            </div>
          ) : null}
        </header>
        <div className="scroll">{children}</div>
      </div>
      {adding ? <ManualEntry onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
