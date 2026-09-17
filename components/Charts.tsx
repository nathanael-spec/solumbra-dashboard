'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps,
} from 'recharts';
import { money, count } from '@/lib/format';

const INK46 = 'rgba(255,255,255,0.46)';
const GRID = 'rgba(255,255,255,0.06)';
export const S1 = 'rgba(255,255,255,0.86)';
export const S2 = 'rgba(138,156,156,0.95)';
export const S3 = 'rgba(255,255,255,0.34)';
export const ACCENT = '#A6631D';

type Fmt = (v: number) => string;

/**
 * `shareOf` names the base series. Every other series then shows its share of
 * it, as a percentage when the base is 10 or more, as "3 of 7" below that.
 */
function Tip({ active, payload, label, fmt, names, shareOf }: TooltipProps<number, string> & { fmt: Fmt; names: Record<string, string>; shareOf?: string }) {
  if (!active || !payload?.length) return null;
  const base = shareOf ? Number(payload.find((p) => String(p.dataKey) === shareOf)?.value ?? 0) : 0;
  const share = (key: string, v: number): string => {
    if (!shareOf || key === shareOf || !base) return '';
    return base >= 10 ? `${Math.round((100 * v) / base)}%` : `${v} of ${base}`;
  };
  return (
    <div className="tip">
      <div className="t">{label}</div>
      {payload.map((p) => (
        <div className="r" key={String(p.dataKey)}><span>{names[String(p.dataKey)] ?? String(p.dataKey)}</span><span>{fmt(Number(p.value))}<span style={{ color: 'rgba(255,255,255,.56)', marginLeft: 8 }}>{share(String(p.dataKey), Number(p.value))}</span></span></div>
      ))}
    </div>
  );
}

const axis = { tick: { fill: INK46, fontSize: 11 }, axisLine: false, tickLine: false } as const;

/** A tiny line with no axes, for a stat tile. */
export function Spark({ data, x, y, fmt = count }: { data: object[]; x: string; y: string; fmt?: Fmt }) {
  return (
    <div className="chart" style={{ minHeight: 64 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <Area type="linear" dataKey={y} stroke={S1} strokeWidth={1.5} fill="rgba(255,255,255,0.06)" isAnimationActive={false} dot={false} activeDot={{ r: 4, fill: S1, stroke: 'none' }} />
          <Tooltip content={<Tip fmt={fmt} names={{ [y]: 'value' }} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
          <XAxis dataKey={x} tick={{ fill: 'rgba(255,255,255,0.56)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={30} height={18} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two bar series side by side, labelled in the legend and the tooltip. */
export function Bars({ data, x, series, fmt = money, tall = false, reference, shareOf }: {
  data: object[]; x: string; series: { key: string; name: string; color?: string }[]; fmt?: Fmt; tall?: boolean; reference?: { y: number; label: string }; shareOf?: string;
}) {
  const names = Object.fromEntries(series.map((s) => [s.key, s.name]));
  const colors = [S1, S2, S3];
  return (
    <>
      <div className={`chart${tall ? ' tall' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey={x} {...axis} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => fmt(v)} />
            <Tooltip content={<Tip fmt={fmt} names={names} shareOf={shareOf} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            {reference ? <ReferenceLine y={reference.y} stroke={ACCENT} strokeDasharray="4 4" label={{ value: reference.label, fill: ACCENT, fontSize: 11, position: 'insideTopRight' }} /> : null}
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color ?? colors[i]} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={38} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 ? <div className="legend">{series.map((s, i) => <span key={s.key}><i style={{ background: s.color ?? colors[i] }} />{s.name}</span>)}</div> : null}
    </>
  );
}

export function Lines({ data, x, series, fmt = money, tall = false, reference }: {
  data: object[]; x: string; series: { key: string; name: string; color?: string }[]; fmt?: Fmt; tall?: boolean; reference?: { y: number; label: string };
}) {
  const names = Object.fromEntries(series.map((s) => [s.key, s.name]));
  const colors = [S1, S2, S3];
  return (
    <>
      <div className={`chart${tall ? ' tall' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey={x} {...axis} />
            <YAxis {...axis} width={44} tickFormatter={(v: number) => fmt(v)} />
            <Tooltip content={<Tip fmt={fmt} names={names} />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
            {reference ? <ReferenceLine y={reference.y} stroke={ACCENT} strokeDasharray="4 4" label={{ value: reference.label, fill: ACCENT, fontSize: 11, position: 'insideTopRight' }} /> : null}
            {series.map((s, i) => (
              <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color ?? colors[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'none', fill: s.color ?? colors[i] }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 ? <div className="legend">{series.map((s, i) => <span key={s.key}><i style={{ background: s.color ?? colors[i] }} />{s.name}</span>)}</div> : null}
    </>
  );
}

/** Horizontal bars, biggest first, each labelled by name. */
export function HBars({ data, name, value, fmt = money, tall = false }: { data: object[]; name: string; value: string; fmt?: Fmt; tall?: boolean }) {
  return (
    <div className={`chart${tall ? ' tall' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 2, right: 40, bottom: 0, left: 4 }} barCategoryGap="30%">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={name} {...axis} width={124} tick={{ fill: 'rgba(255,255,255,0.68)', fontSize: 11.5 }} />
          <Tooltip content={<Tip fmt={fmt} names={{ [value]: 'amount' }} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey={value} fill={S2} radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={16} label={{ position: 'right', fill: INK46, fontSize: 11, formatter: (v: number) => fmt(v) }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
