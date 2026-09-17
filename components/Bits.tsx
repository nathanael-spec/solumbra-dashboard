import type { Rate } from '@/lib/metrics';
import { count, pct } from '@/lib/format';

/** A rate the way his sample size rule wants it: a fraction under the floor, a percentage above it. */
export function RateText({ r, digits = 0 }: { r: Rate; digits?: number }) {
  if (r.whole === 0) return <span className="tabular">none yet</span>;
  if (r.pct === null) return <span className="tabular">{count(r.part)} of {count(r.whole)}</span>;
  return <span className="tabular">{pct(r.pct, digits)} <span style={{ color: 'rgba(255,255,255,.46)' }}>({count(r.part)} of {count(r.whole)})</span></span>;
}

export function Hero({ value, unit, small = false }: { value: string; unit?: string; small?: boolean }) {
  return <div className={`hero${small ? ' small' : ''}`}>{value}{unit ? <span className="unit">{unit}</span> : null}</div>;
}

export function KV({ rows }: { rows: { k: string; v: React.ReactNode; muted?: boolean }[] }) {
  return (
    <div>
      {rows.map((r) => (
        <div className="kv" key={r.k}><span className="k">{r.k}</span><span className={`v${r.muted ? ' muted' : ''}`}>{r.v}</span></div>
      ))}
    </div>
  );
}

/** Counted marks, never a bar. Twenty marks, one per 5%. */
export function Marks({ share }: { share: number }) {
  const done = Math.max(0, Math.min(20, Math.floor(share * 20)));
  return (
    <div className="marks" aria-label={`${Math.round(share * 100)} percent of the way`}>
      {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < done ? 'done' : i === done && share > 0 ? 'now' : ''} />)}
    </div>
  );
}

export function Table({ head, rows, numeric = [] }: { head: string[]; rows: React.ReactNode[][]; numeric?: number[] }) {
  return (
    <div className="table-scroll">
      <table className="grid-table">
        <thead><tr>{head.map((h, i) => <th key={h} className={numeric.includes(i) ? 'n' : ''}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => <td key={ci} className={numeric.includes(ci) ? 'n' : ''}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
