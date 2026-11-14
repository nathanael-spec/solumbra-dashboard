'use client';

import { useEffect, useState } from 'react';
import { Tile, Problem, Empty } from '@/components/Tile';
import { Table } from '@/components/Bits';
import { Bars, Lines, ACCENT } from '@/components/Charts';
import { NotConnected } from '@/components/NotConnected';
import { useDash } from '@/lib/store';
import { count, pct } from '@/lib/format';
import { retroSeries, span, bucketFor } from '@/lib/retro';
import type { RetroChannel, RetroNumber, RetroRecord, RetroStep, RetroLearning } from '@/lib/types';

const longDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** A retro number the way it was measured: counts, one decimal, or a share. */
function fmt(v: number | null, kind: RetroNumber['kind']): string {
  if (v === null || v === undefined) return 'n/a';
  if (kind === 'pct') return pct(v * 100, 1);
  if (kind === 'pct2') return pct(v * 100, 2);
  if (kind === 'dec') return v.toFixed(1);
  return count(Math.round(v));
}

function Delta({ n }: { n: RetroNumber }) {
  if (n.now === null || n.prev === null) return <span className="muted">n/a</span>;
  const d = n.now - n.prev;
  if (Math.abs(d) < 1e-9) return <span className="muted">same</span>;
  const better = n.lower_better ? d < 0 : d > 0;
  const size = n.kind.startsWith('pct') ? `${(Math.abs(d) * 100).toFixed(n.kind === 'pct2' ? 2 : 1)} pts` : n.kind === 'dec' ? Math.abs(d).toFixed(1) : count(Math.round(Math.abs(d)));
  return <span className={better ? 'up' : 'down'}>{d > 0 ? '+' : '−'}{size}</span>;
}

function Numbers({ ch }: { ch: RetroChannel }) {
  return (
    <div className="table-scroll"><table className="grid-table retro-num">
      <thead><tr><th>Number</th><th className="n">This period</th><th className="n">Before</th><th className="n">Change</th><th className="n">All time</th></tr></thead>
      <tbody>
        {ch.numbers.map((n) => (
          <tr key={n.label}>
            <td>{n.label}</td>
            <td className="n strong">{fmt(n.now, n.kind)}</td>
            <td className="n muted">{fmt(n.prev, n.kind)}</td>
            <td className="n"><Delta n={n} /></td>
            <td className="n muted">{fmt(n.all, n.kind)}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

/** Each step of the funnel: how many reached it, the share of the step before, and the normal share as a tick. */
function Funnel({ steps }: { steps: RetroStep[] }) {
  return (
    <div className="funnel">
      {steps.map((s) => {
        const rate = s.rate ?? null, normal = s.normal_rate ?? null;
        const top = Math.max(rate ?? 0, normal ?? 0, 0.0001) * 1.25;
        return (
          <div key={s.step} className={`funnel-row${s.broken ? ' broken' : ''}`}>
            <div className="f-name">{s.step}{s.broken ? <span className="f-flag">breaks here</span> : null}</div>
            <div className="f-count">{count(s.count)}</div>
            {rate === null && normal === null ? <div className="f-track none">start</div> : (
              <div className="f-track" aria-label={`${s.step}: ${rate === null ? 'none' : pct(rate * 100, 1)} of the step before, normal ${normal === null ? 'unknown' : pct(normal * 100, 1)}`}>
                <i className="f-bar" style={{ width: `${Math.min(100, ((rate ?? 0) / top) * 100)}%` }} />
                {normal !== null ? <i className="f-normal" style={{ left: `${Math.min(100, (normal / top) * 100)}%` }} /> : null}
              </div>
            )}
            <div className="f-rate">{rate === null ? '' : pct(rate * 100, rate < 0.01 ? 2 : 1)}<span className="muted">{normal === null ? '' : ` normal ${pct(normal * 100, normal < 0.01 ? 2 : 1)}`}</span></div>
          </div>
        );
      })}
      <div className="tile-foot">Bar: share of the step before, this period. Tick: your normal, all time.</div>
    </div>
  );
}

function Points({ title, items, tone }: { title: string; items?: { what: string; evidence: string }[]; tone: string }) {
  return (
    <div className={`kcs ${tone}`}>
      <div className="spec">{title}</div>
      {items?.length ? items.map((p, i) => (
        <div key={i} className="kcs-item"><div className="what">{p.what}</div><div className="why">{p.evidence}</div></div>
      )) : <Empty text="Nothing here this time." />}
    </div>
  );
}

const STATUS_ORDER: RetroLearning['status'][] = ['working', 'testing', 'not working', 'dropped'];

function Learnings({ items }: { items?: RetroLearning[] }) {
  if (!items?.length) return <Empty text="No lessons recorded yet. Each retro adds what the data proved or disproved." />;
  const sorted = [...items].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  return (
    <div className="learn">
      {sorted.map((l, i) => (
        <div key={i} className="learn-row"><span className={`chip ${l.status.replace(' ', '-')}`}>{l.status}</span><div><div className="what">{l.rule}</div><div className="why">{l.evidence}</div></div></div>
      ))}
    </div>
  );
}

function Trend({ name, rows, readings }: { name: string; rows: ReturnType<typeof retroSeries>; readings: { date: string; n: number }[] }) {
  const pctFmt = (v: number) => pct(v, 0);
  if (name === 'LinkedIn') {
    const last = readings[readings.length - 1];
    return (
      <div className="trend-pair">
        <div><div className="spec sub">Followers</div>{readings.length >= 2 ? <Lines data={rows} x="label" series={[{ key: 'followers', name: 'Followers' }]} fmt={count} /> : last ? <div className="one-reading"><div className="hero small">{count(last.n)}</div><div className="sub-line">One reading so far ({last.date}). The line starts with the next retro, or with LinkedIn's follower export.</div></div> : <Empty text="No follower reading yet." />}</div>
        <div><div className="spec sub">Impressions</div><Bars data={rows} x="label" series={[{ key: 'impressions', name: 'Impressions' }]} fmt={count} /></div>
      </div>
    );
  }
  if (name === 'Upwork') {
    return (
      <div className="trend-pair">
        <div><div className="spec sub">Applications down to hires</div><Bars data={rows} x="label" series={[{ key: 'apps', name: 'Sent' }, { key: 'viewed', name: 'Viewed' }, { key: 'replied', name: 'Replied' }]} fmt={count} shareOf="apps" /></div>
        <div><div className="spec sub">View rate and view to reply rate</div><Lines data={rows} x="label" series={[{ key: 'viewRate', name: 'View rate' }, { key: 'viewToReply', name: 'View to reply', color: ACCENT }]} fmt={pctFmt} /></div>
      </div>
    );
  }
  return (
    <div className="trend-pair">
      <div><div className="spec sub">Emails sent</div><Bars data={rows} x="label" series={[{ key: 'sent', name: 'Sent' }]} fmt={count} /></div>
      <div><div className="spec sub">Reply rate and positive rate</div><Lines data={rows} x="label" series={[{ key: 'replyRate', name: 'Reply rate' }, { key: 'positiveRate', name: 'Positive rate', color: ACCENT }]} fmt={(v) => pct(v, 2)} /></div>
    </div>
  );
}

function Channel({ ch, rows, rangeText, readings }: { ch: RetroChannel; rows: ReturnType<typeof retroSeries>; rangeText: string; readings: { date: string; n: number }[] }) {
  const id = ch.name.toLowerCase().replace(/\s+/g, '-');
  return (
    <>
      <h2 className="retro-h" id={id}>{ch.name}</h2>
      <Tile title="What the data says to do" span={7} foot={ch.sample_note}>
        {ch.verdict ? <p className="verdict">{ch.verdict}</p> : null}
        <div className="kcs-grid">
          <Points title="Keep doing" items={ch.keep} tone="keep" />
          <Points title="Change" items={ch.change} tone="change" />
          <Points title="Stop" items={ch.stop} tone="stop" />
        </div>
      </Tile>
      <Tile title={ch.funnel.length ? 'Where it breaks' : 'Numbers'} span={5} foot={ch.funnel.length ? ch.breaks : undefined}>
        {ch.funnel.length ? <Funnel steps={ch.funnel} /> : (
          <>{ch.breaks ? <p className="verdict small">{ch.breaks}</p> : null}<Numbers ch={ch} /></>
        )}
      </Tile>
      <Tile title={`Over time, ${rangeText}`} span={7} foot="Follows the period picked at the top.">
        <Trend name={ch.name} rows={rows} readings={readings} />
      </Tile>
      {ch.funnel.length ? (
        <Tile title="Every number" span={5}><Numbers ch={ch} /></Tile>
      ) : (
        <Tile title="Best and worst" span={5}>
          {ch.top?.length ? <Table head={['Item', 'Result', 'Why']} rows={ch.top.map((t) => [t.label, t.value, t.note ?? ''])} /> : <Empty text="Nothing ranked yet." />}
        </Tile>
      )}
      {ch.diagnosis?.length ? (
        <Tile title="Why, step by step" span={7}>
          <Table head={['Step', 'What the numbers say', 'What to try']} rows={ch.diagnosis.map((d) => [<b key="s">{d.stage}</b>, d.says, d.fix])} />
        </Tile>
      ) : null}
      <Tile title="What we have learned so far" span={ch.diagnosis?.length ? 5 : 12}>
        <Learnings items={ch.learnings} />
      </Tile>
    </>
  );
}

export default function RetroPage() {
  const { blob, loading, period, today } = useDash();
  const [pick, setPick] = useState<string>('');
  const retros = blob?.retro.ok ? blob.retro.data.retros : [];
  useEffect(() => { if (!pick && retros.length) setPick(retros[retros.length - 1].date); }, [retros, pick]);

  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.retro.ok && blob.retro.off) return <NotConnected tool="the retrospective sheet" how="Set RETRO_SHEET_ID to the sheet the /retrospective routine writes, and connect Google." />;
  if (!blob.retro.ok) return <div className="report-scroll"><main className="page report"><Tile title="Retro" span={12}><Problem text={`The retrospective sheet could not be read. ${blob.retro.error}`} /></Tile></main></div>;

  const { days } = blob.retro.data;
  const r: RetroRecord | undefined = retros.find((x) => x.date === pick) ?? retros[retros.length - 1];
  const { start, end } = span(days, period, today);
  const rows = retroSeries(days, start, end);
  const by = bucketFor(start, end);
  const rangeText = `by ${by}`;
  const readings = days.filter((d) => d.li_followers !== undefined && d.date <= end).map((d) => ({ date: d.date, n: d.li_followers as number }));

  if (!r) return <div className="report-scroll"><main className="page report"><Tile title="Retro" span={12}><Empty text="No retrospective yet. Run /retrospective in Claude Code and it appears here." /></Tile></main></div>;

  return (
    <div className="report-scroll"><main className="page report">
      <section className="retro-top" style={{ gridColumn: '1 / -1' }}>
        <div>
          <div className="spec">Retrospective</div>
          <h1>{longDate(r.date)}</h1>
          <div className="sub-line">Covers {longDate(r.start)} to {longDate(r.end)}{r.prev_start ? `, compared with ${longDate(r.prev_start)} to ${longDate(r.prev_end ?? r.prev_start)}` : ''}.</div>
        </div>
        {retros.length > 1 ? (
          <label className="retro-pick"><span className="spec">Other retros</span>
            <select value={r.date} onChange={(e) => setPick(e.target.value)}>
              {[...retros].reverse().map((x) => <option key={x.date} value={x.date}>{longDate(x.date)}</option>)}
            </select>
          </label>
        ) : null}
        <nav className="retro-jump" aria-label="Jump to a channel">
          {r.channels.map((c) => <a key={c.name} href={`#${c.name.toLowerCase().replace(/\s+/g, '-')}`}>{c.name}</a>)}
        </nav>
      </section>

      <Tile title="Read this first" span={5}>
        <ol className="summary">{r.summary.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </Tile>
      <Tile title="The changes we are making" span={7}>
        <div className="changes">
          {r.channels.map((c) => (
            <div key={c.name} className="change-card">
              <div className="spec">{c.name}</div>
              <div className="what">{c.next_change ?? 'No change this time.'}</div>
              {c.measure ? <div className="why">How we will know: {c.measure}</div> : null}
              {c.last_change ? <div className="last">Last time: {c.last_change}{c.last_verdict?.done ? ` Done: ${c.last_verdict.done}.` : ''}{c.last_verdict?.worked ? ` Result: ${c.last_verdict.worked}` : ''}</div> : null}
            </div>
          ))}
        </div>
      </Tile>

      {r.channels.map((c) => <Channel key={c.name} ch={c} rows={rows} rangeText={rangeText} readings={readings} />)}
    </main></div>
  );
}
