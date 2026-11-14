import type { ReactNode } from 'react';
import type { Rate } from '@/lib/metrics';
import { count, pct } from '@/lib/format';

/** A rate the way his sample size rule wants it: a fraction under the floor, a percentage above it. */
export function RateText({ r, digits = 0 }: { r: Rate; digits?: number }) {
  if (r.whole === 0) return <span className="tabular">none yet</span>;
  // Under the sample size floor the fraction leads, and the percentage follows in a quieter tone.
  if (r.pct === null) return <span className="tabular">{count(r.part)} of {count(r.whole)} <span className="quiet">({pct((100 * r.part) / r.whole, digits)})</span></span>;
  return <span className="tabular">{pct(r.pct, digits)} <span className="quiet">({count(r.part)} of {count(r.whole)})</span></span>;
}

export function Hero({ value, unit, small = false }: { value: string; unit?: string; small?: boolean }) {
  return <div className={`hero${small ? ' small' : ''}`}>{value}{unit ? <span className="unit">{unit}</span> : null}</div>;
}

/**
 * Up or down against the period before, in words, with a small arrow. Green
 * when the move is good for the business, orange when it is not. The arrow and
 * the words carry the meaning, the colour only repeats it.
 */
export function Change({ now, before, fmt = count, versus, lowerIsBetter = false }: {
  now: number; before: number | null | undefined; fmt?: (n: number) => string; versus: string; lowerIsBetter?: boolean;
}) {
  if (before === null || before === undefined) return null;
  const diff = Math.round((now - before) * 100) / 100;
  if (diff === 0) return <div className="change same">Same as {versus}</div>;
  const up = diff > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <div className={`change ${good ? 'good' : 'bad'}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d={up ? 'M6 2 L11 10 L1 10 Z' : 'M6 10 L11 2 L1 2 Z'} fill="currentColor" /></svg>
      <span>{fmt(Math.abs(diff))} {up ? 'more' : 'less'} than {versus}</span>
    </div>
  );
}

export function KV({ rows }: { rows: { k: string; v: ReactNode; muted?: boolean }[] }) {
  return (
    <div>
      {rows.map((r) => (
        <div className="kv" key={r.k}><span className="k">{r.k}</span><span className={`v${r.muted ? ' muted' : ''}`}>{r.v}</span></div>
      ))}
    </div>
  );
}

/** Named amounts as horizontal bars, biggest first, with the value written at the end of each row. */
export function BarList({ rows, fmt, color }: { rows: { name: string; value: number }[]; fmt: (n: number) => string; color?: string }) {
  const top = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <div className="barlist">
      {rows.map((r) => (
        <div className="barlist-row" key={r.name}>
          <span className="name">{r.name}</span>
          <span className="value">{fmt(r.value)}</span>
          <span className="track"><i style={{ width: `${Math.max(1.5, (100 * r.value) / top)}%`, background: color }} /></span>
        </div>
      ))}
    </div>
  );
}

/** A plain sentence that points at something to fix. No icon, no red box. */
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice" role="note">{children}</div>;
}

export function Table({ head, rows, numeric = [] }: { head: string[]; rows: ReactNode[][]; numeric?: number[] }) {
  return (
    <div className="table-scroll">
      <table className="grid-table">
        <thead><tr>{head.map((h, i) => <th key={h + i} className={numeric.includes(i) ? 'n' : ''}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => <td key={ci} className={numeric.includes(ci) ? 'n' : ''}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
