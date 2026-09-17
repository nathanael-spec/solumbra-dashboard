'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, RateText, Table } from '@/components/Bits';
import { Bars } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, pct, shortDate, ago, weekLabel } from '@/lib/format';
import { CONNECT_PRICE, upworkPeriod, upworkWeekly } from '@/lib/metrics';
import { NotConnected } from '@/components/NotConnected';

export default function UpworkPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.vollna.ok && blob.vollna.off) return <NotConnected tool="Vollna" how="Vollna is the only readable source of Upwork proposal results. Run npm run setup and paste its token." />;
  if (!blob.vollna.ok) return <main className="page rows-aab"><Tile title="Upwork" span={12}><Problem text={`Vollna could not be read. ${blob.vollna.error}`} /></Tile></main>;
  const v = blob.vollna.data;
  const u = upworkPeriod(v.proposals, period);
  const weeks = upworkWeekly(v.proposals, today, 12).map((w) => ({ ...w, label: weekLabel(w.week) }));
  const early = u.sent < 50;

  return (
    <main className="page rows-aab">
      <Tile title="Applications sent" span={3} short>
        <Hero value={count(u.sent)} small />
        {u.withdrawn ? <div className="sub-line">{count(u.withdrawn)} withdrawn, not counted</div> : null}
      </Tile>
      <Tile title="Viewed by the client" span={3} short>
        <Hero value={early ? count(u.viewed) : pct(u.viewRate.pct ?? 0, 0)} small unit={early ? `of ${count(u.sent)}` : `${count(u.viewed)} of ${count(u.sent)}`} />
      </Tile>
      <Tile title="Turned into a conversation" span={3} short>
        <Hero value={early ? count(u.interviewed) : pct(u.interviewRate.pct ?? 0, 0)} small unit={early ? `of ${count(u.sent)}` : `${count(u.interviewed)} of ${count(u.sent)}`} />
        <div className="sub-line">Of the viewed ones: <RateText r={u.viewToInterview} /></div>
      </Tile>
      <Tile title="Hired" span={3} short>
        <Hero value={early ? count(u.hired) : pct(u.hireRate.pct ?? 0, 0)} small unit={early ? `of ${count(u.sent)}` : `${count(u.hired)} of ${count(u.sent)}`} />
        <div className="sub-line">Of the conversations: <RateText r={u.interviewToHire} /></div>
      </Tile>

      <Tile title="Connects" span={6} short>
        <KV rows={[
          { k: 'Spent this period', v: count(u.connects) },
          { k: `At ${money(CONNECT_PRICE, true)} each, about`, v: money(u.dollars, true) },
          { k: 'Applications boosted', v: count(u.boosts), muted: !u.boosts },
          { k: 'Balance now', v: v.connectsBalance === null ? 'unknown' : count(v.connectsBalance) },
          { k: 'Vollna last synced', v: v.lastSyncAt ? ago(v.lastSyncAt) : 'unknown', muted: true },
        ]} />
      </Tile>
      <Tile title="Latest applications" span={6} short bigTitle="Every application in the period"
        big={<Table head={['Sent', 'Job', 'Client', 'Connects', 'Viewed', 'Conversation', 'Hired']} numeric={[3]} rows={u.proposals.map((p) => [shortDate(p.submittedAt), p.title, p.client, count(p.connects + p.boost), p.viewed ? 'yes' : '', p.interviewed ? 'yes' : '', p.hired ? 'yes' : ''])} />}>
        <div className="table-scroll">
          {u.proposals.slice(0, 5).map((p) => (
            <div className="kv" key={p.uid}><span className="k" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span><span className="v muted" style={{ whiteSpace: 'nowrap' }}>{p.hired ? 'hired' : p.interviewed ? 'conversation' : p.viewed ? 'viewed' : 'not viewed'}<span style={{ display: 'inline-block', width: 52, textAlign: 'right' }}>{shortDate(p.submittedAt)}</span></span></div>
          ))}
        </div>
      </Tile>
      <Tile title="Week by week" span={12} big={<Bars data={weeks} x="label" series={[{ key: 'sent', name: 'Sent' }, { key: 'viewed', name: 'Viewed' }, { key: 'interviewed', name: 'Conversations' }, { key: 'hired', name: 'Hired', color: 'rgba(255,255,255,0.18)' }]} fmt={count} tall shareOf="sent" />}>
        <Bars data={weeks} x="label" series={[{ key: 'sent', name: 'Sent' }, { key: 'viewed', name: 'Viewed' }, { key: 'interviewed', name: 'Conversations' }, { key: 'hired', name: 'Hired', color: 'rgba(255,255,255,0.18)' }]} fmt={count} tall shareOf="sent" />
      </Tile>
    </main>
  );
}
