'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, RateText, Table } from '@/components/Bits';
import { Bars } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, pct, shortDate, ago, weekLabel } from '@/lib/format';
import { CONNECT_PRICE, THIN_SAMPLE, upworkPeriod, upworkWeekly, type Rate } from '@/lib/metrics';
import { NotConnected } from '@/components/NotConnected';

/** The big number on a funnel tile: a percentage in every period, or plain words when nothing was sent. */
const heroPct = (r: Rate) => (r.pct === null ? 'none yet' : pct(r.pct, 0));
const outOf = (part: number, whole: number) => `${count(part)} of ${count(whole)}`;

export default function UpworkPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.vollna.ok && blob.vollna.off) return <NotConnected tool="Vollna" how="Upwork itself does not say who read an application. Vollna does. Run npm run setup and paste its token, or export your proposals from vollna.com into an &quot;Upwork proposals&quot; tab in the dashboard sheet." />;
  if (!blob.vollna.ok) return <main className="page rows-aab"><Tile title="Upwork" span={12}><Problem text={`The Upwork applications could not be read. ${blob.vollna.error}`} /></Tile></main>;
  const v = blob.vollna.data;
  const u = upworkPeriod(v.proposals, period);
  const weeks = upworkWeekly(v.proposals, today, 12).map((w) => ({ ...w, label: weekLabel(w.week) }));

  return (
    <main className="page rows-aab">
      <Tile title="Applications sent" span={3} short>
        <Hero value={count(u.sent)} small />
        {u.withdrawn ? <div className="sub-line">{count(u.withdrawn)} withdrawn, not counted</div> : null}
        {u.sent > 0 && u.thin ? <div className="sub-line">Under {THIN_SAMPLE} in this period, so the rates below move a lot.</div> : null}
        {v.from === 'sheet' ? <div className="sub-line">From the Upwork proposals tab, not a live read.</div> : null}
      </Tile>
      <Tile title="Viewed by the client" span={3} short>
        <Hero value={heroPct(u.viewRate)} small unit={outOf(u.viewed, u.sent)} />
      </Tile>
      <Tile title="Replied" span={3} short>
        <Hero value={heroPct(u.replyRate)} small unit={outOf(u.replies, u.sent)} />
        <div className="sub-line">Of the viewed ones: <RateText r={u.conversionRate} /></div>
      </Tile>
      <Tile title="Hired" span={3} short>
        <Hero value={heroPct(u.hireRate)} small unit={outOf(u.hired, u.sent)} />
        <div className="sub-line">Of the replies: <RateText r={u.replyToHire} /></div>
      </Tile>

      <Tile title="Rates" span={6} short foot="View and reply rates are out of the applications sent. Conversion rate is the replies out of the ones a client actually opened.">
        <KV rows={[
          { k: 'View rate', v: <RateText r={u.viewRate} /> },
          { k: 'Reply rate', v: <RateText r={u.replyRate} /> },
          { k: 'Conversion rate', v: <RateText r={u.conversionRate} /> },
          { k: 'Hire rate', v: <RateText r={u.hireRate} /> },
        ]} />
      </Tile>
      <Tile title="What it costs" span={6} short foot={`Connects only, at ${money(CONNECT_PRICE, true)} each. Upwork fees and anything else you pay are not in these two numbers.`}>
        <KV rows={[
          { k: 'Connects spent this period', v: `${count(u.connects)}, about ${money(u.dollars, true)}` },
          { k: 'Cost per reply', v: u.costPerReply === null ? 'no replies yet' : money(u.costPerReply, true), muted: u.costPerReply === null },
          { k: 'Client acquisition cost', v: u.cac === null ? 'no one hired yet' : money(u.cac, true), muted: u.cac === null },
          { k: 'Applications boosted', v: count(u.boosts), muted: !u.boosts },
          { k: 'Connects balance now', v: v.connectsBalance === null ? 'unknown' : count(v.connectsBalance), muted: v.connectsBalance === null },
          v.from === 'api'
            ? { k: 'Vollna last synced', v: v.lastSyncAt ? ago(v.lastSyncAt) : 'unknown', muted: true }
            : { k: 'Newest application in the sheet', v: v.lastSyncAt ? ago(v.lastSyncAt) : 'unknown', muted: true },
        ]} />
      </Tile>

      <Tile title="Week by week" span={8} big={<Bars data={weeks} x="label" series={[{ key: 'sent', name: 'Sent' }, { key: 'viewed', name: 'Viewed' }, { key: 'interviewed', name: 'Replies' }, { key: 'hired', name: 'Hired', color: 'rgba(255,255,255,0.18)' }]} fmt={count} tall shareOf="sent" />}>
        <Bars data={weeks} x="label" series={[{ key: 'sent', name: 'Sent' }, { key: 'viewed', name: 'Viewed' }, { key: 'interviewed', name: 'Replies' }, { key: 'hired', name: 'Hired', color: 'rgba(255,255,255,0.18)' }]} fmt={count} tall shareOf="sent" />
      </Tile>
      <Tile title="Latest applications" span={4} bigTitle="Every application in the period"
        big={<Table head={['Sent', 'Job', 'Client', 'Connects', 'Viewed', 'Replied', 'Hired']} numeric={[3]} rows={u.proposals.map((p) => [shortDate(p.submittedAt), p.title, p.client, count(p.connects), p.viewed ? 'yes' : '', p.interviewed ? 'yes' : '', p.hired ? 'yes' : ''])} />}>
        <div className="table-scroll">
          {u.proposals.slice(0, 6).map((p) => (
            <div className="kv" key={p.uid}><span className="k" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span><span className="v muted" style={{ whiteSpace: 'nowrap' }}>{p.hired ? 'hired' : p.interviewed ? 'replied' : p.viewed ? 'viewed' : 'not viewed'}<span style={{ display: 'inline-block', width: 52, textAlign: 'right' }}>{shortDate(p.submittedAt)}</span></span></div>
          ))}
        </div>
      </Tile>
    </main>
  );
}
