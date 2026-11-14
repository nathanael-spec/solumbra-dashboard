'use client';

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps,
} from 'recharts';
import { money, moneyShort } from '@/lib/format';

/**
 * Chart colours. Colour says which series a mark belongs to, always in this
 * order, and every chart with two or more series also carries a legend. The
 * set was checked for colour blind separation and contrast on the tile surface.
 */
export const C1 = '#3987e5';   // blue: money in, the main series
export const C2 = '#d95926';   // orange: money out, costs
export const C3 = '#199e70';   // green
export const C4 = '#c98500';   // yellow
/** Kept for the Retro screen, which names its second series by hand. */
export const ACCENT = C2;
const COLORS = [C1, C2, C3, C4];

const INK = 'rgba(255,255,255,0.95)';
const INK68 = 'rgba(255,255,255,0.68)';
const GRID = 'rgba(255,255,255,0.08)';
const REF = 'rgba(255,255,255,0.55)';

type Fmt = (v: number) => string;
export interface Series { key: string; name: string; color?: string }

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
      {payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => (
        <div className="r" key={String(p.dataKey)}>
          <span><i style={{ background: String(p.color ?? p.stroke ?? INK) }} />{names[String(p.dataKey)] ?? String(p.dataKey)}</span>
          <span>{fmt(Number(p.value))}<span className="share">{share(String(p.dataKey), Number(p.value))}</span></span>
        </div>
      ))}
    </div>
  );
}

const tick = { fill: INK68, fontSize: 13 } as const;
const xAxis = { tick, axisLine: false, tickLine: false, tickMargin: 10, height: 34, interval: 'preserveStartEnd', minTickGap: 18 } as const;
const yAxis = { tick, axisLine: false, tickLine: false, width: 58, tickCount: 5 } as const;
const margin = { top: 26, right: 12, bottom: 0, left: 0 };
const axisOf = (fmt: Fmt, axisFmt?: Fmt): Fmt => axisFmt ?? (fmt === money ? moneyShort : fmt);

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return <div className="legend">{series.map((s, i) => <span key={s.key}><i style={{ background: s.color ?? COLORS[i] }} />{s.name}</span>)}</div>;
}

/**
 * Bars, one group per label. With few bars the value is written on top of each
 * one, so the chart reads without hovering.
 */
export function Bars({ data, x, series, fmt = money, axisFmt, tall = false, reference, shareOf, labels }: {
  data: object[]; x: string; series: Series[]; fmt?: Fmt; axisFmt?: Fmt; tall?: boolean; reference?: { y: number; label: string }; shareOf?: string; labels?: boolean;
}) {
  const names = Object.fromEntries(series.map((s) => [s.key, s.name]));
  const showLabels = labels ?? data.length * series.length <= 14;
  const short = axisOf(fmt, axisFmt);
  return (
    <>
      <Legend series={series} />
      <div className={`chart${tall ? ' tall' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={margin} barGap={3} barCategoryGap={data.length > 16 ? '18%' : '26%'}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey={x} {...xAxis} />
            <YAxis {...yAxis} tickFormatter={(v: number) => short(v)} allowDecimals={false} />
            <Tooltip content={<Tip fmt={fmt} names={names} shareOf={shareOf} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            {reference ? <ReferenceLine y={reference.y} stroke={REF} strokeDasharray="5 5" label={{ value: reference.label, fill: INK68, fontSize: 13, position: 'insideTopRight' }} /> : null}
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color ?? COLORS[i]} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={64}>
                {showLabels ? <LabelList dataKey={s.key} position="top" offset={8} fill={INK} fontSize={13} formatter={(v: number) => (v ? short(v) : '')} /> : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/**
 * Lines over time. Thick strokes, a dot on every real point, and the newest
 * value written at the end of each line. `area` fills under a single line.
 */
export function Lines({ data, x, series, fmt = money, axisFmt, tall = false, reference, area = false }: {
  data: object[]; x: string; series: Series[]; fmt?: Fmt; axisFmt?: Fmt; tall?: boolean; reference?: { y: number; label: string }; area?: boolean;
}) {
  const names = Object.fromEntries(series.map((s) => [s.key, s.name]));
  const short = axisOf(fmt, axisFmt);
  const dots = data.length <= 32;
  const rows = data as Record<string, unknown>[];
  const lastIndex = (key: string): number => {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i][key] !== null && rows[i][key] !== undefined) return i;
    return -1;
  };
  return (
    <>
      <Legend series={series} />
      <div className={`chart${tall ? ' tall' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ ...margin, right: 64 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey={x} {...xAxis} />
            <YAxis {...yAxis} tickFormatter={(v: number) => short(v)} />
            <Tooltip content={<Tip fmt={fmt} names={names} />} cursor={{ stroke: 'rgba(255,255,255,0.3)' }} />
            {reference ? <ReferenceLine y={reference.y} stroke={REF} strokeDasharray="5 5" label={{ value: reference.label, fill: INK68, fontSize: 13, position: 'insideBottomLeft' }} /> : null}
            {area && series.length === 1 ? <Area type="linear" dataKey={series[0].key} stroke="none" fill={series[0].color ?? C1} fillOpacity={0.16} isAnimationActive={false} tooltipType="none" activeDot={false} /> : null}
            {series.map((s, i) => {
              const color = s.color ?? COLORS[i];
              const last = lastIndex(s.key);
              return (
                <Line key={s.key} type="linear" dataKey={s.key} stroke={color} strokeWidth={3} connectNulls isAnimationActive={false}
                  dot={dots ? { r: 4, fill: color, stroke: '#131517', strokeWidth: 2 } : false} activeDot={{ r: 6, fill: color, stroke: '#131517', strokeWidth: 2 }}>
                  <LabelList dataKey={s.key} position="right" offset={10} fill={INK} fontSize={13} formatter={(v: number) => short(v)}
                    content={(p) => (p.index === last && p.value !== null && p.value !== undefined
                      ? <text x={Number(p.x) + 10} y={Number(p.y) + 4} fill={INK} fontSize={13} fontWeight={500}>{short(Number(p.value))}</text> : null)} />
                </Line>
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
