'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, Notice, RateText, Table } from '@/components/Bits';
import { Bars, C1, C2, C3, C4 } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, pct, shortDate, weekLabel } from '@/lib/format';
import { CONNECT_PRICE, THIN_SAMPLE, upworkPeriod, upworkWeekly, type Rate } from '@/lib/metrics';
import { daysBetween } from '@/lib/period';
import { NotConnected } from '@/components/NotConnected';

/** The big number on a rate tile: a percentage in every period, or plain words when nothing was sent. */
const heroPct = (r: Rate) => (r.pct === null ? 'none yet' : pct(r.pct, 0));
const outOf = (part: number, whole: number) => `${count(part)} of ${count(whole)}`;

export default function UpworkPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.vollna.ok && blob.vollna.off) return <NotConnected tool="Vollna" how="Upwork itself does not say who read an application. Vollna does. Run npm run setup and paste its token, or export your proposals from vollna.com into an &quot;Upwork proposals&quot; tab in the dashboard sheet." />;
  if (!blob.vollna.ok) return <main className="page"><div className="full"><Problem text={`The Upwork applications could not be read. ${blob.vollna.error}`} /></div></main>;

  const v = blob.vollna.data;
  const u = upworkPeriod(v.proposals, period);
  const newest = v.proposals.map((x) => x.submittedAt.slice(0, 10)).sort().pop() ?? null;
  const age = newest ? daysBetween(newest, today) : null;
  // The chart ends at the newest application, so an old export still shows its weeks instead of an empty chart.
  const weeks = upworkWeekly(v.proposals, age !== null && age > 14 ? (newest as string) : today, 12).map((w) => ({ ...w, label: weekLabel(w.week) }));
  const label = period.label.toLowerCase();

  return (
    <main className="page">
      {age !== null && age > 14 ? (
        <div className="full"><Notice>The newest application on this page is from {shortDate(newest as string)}, {count(age)} days ago. {v.from === 'sheet' ? 'These numbers come from the Upwork proposals tab, which is filled from a Vollna export. Export again to bring it up to date.' : 'Vollna has not sent anything newer.'}</Notice></div>
      ) : null}

      <Tile title={`Applications sent, ${label}`} span={3}>
        <Hero value={count(u.sent)} />
        {u.withdrawn ? <div className="sub-line">{count(u.withdrawn)} withdrawn, not counted</div> : null}
        {u.sent > 0 && u.thin ? <div className="sub-line">Under {THIN_SAMPLE} applications, so the rates here still move a lot.</div> : null}
      </Tile>
      <Tile title="Opened by the client" span={3}>
        <Hero value={heroPct(u.viewRate)} unit={outOf(u.viewed, u.sent)} />
      </Tile>
      <Tile title="Client wrote back" span={3}>
        <Hero value={heroPct(u.replyRate)} unit={outOf(u.replies, u.sent)} />
        <div className="sub-line">Of the ones they opened: <RateText r={u.conversionRate} /></div>
      </Tile>
      <Tile title="Hired" span={3}>
        <Hero value={heroPct(u.hireRate)} unit={outOf(u.hired, u.sent)} />
        <div className="sub-line">Of the ones who wrote back: <RateText r={u.replyToHire} /></div>
      </Tile>

      <Tile title="Applications, week by week" span={8}>
        <Bars data={weeks} x="label" series={[{ key: 'sent', name: 'Sent', color: C1 }, { key: 'viewed', name: 'Opened', color: C2 }, { key: 'interviewed', name: 'Wrote back', color: C3 }, { key: 'hired', name: 'Hired', color: C4 }]} fmt={count} tall shareOf="sent" labels={false} />
      </Tile>
      <Tile title={`What it cost, ${label}`} span={4} foot={`Connects only, at ${money(CONNECT_PRICE, true)} each. Upwork fees are on the Money screen.`}>
        <KV rows={[
          { k: 'Connects spent', v: `${count(u.connects)}, about ${money(u.dollars)}` },
          { k: 'Cost for one reply', v: u.costPerReply === null ? 'no reply yet' : money(u.costPerReply, true), muted: u.costPerReply === null },
          { k: 'Cost to win one client', v: u.cac === null ? 'no one hired yet' : money(u.cac, true), muted: u.cac === null },
          { k: 'Connects left now', v: v.connectsBalance === null ? 'unknown' : count(v.connectsBalance), muted: v.connectsBalance === null },
        ]} />
      </Tile>

      <Tile title={`Every application, ${label}`} span={12}>
        {u.proposals.length ? (
          <Table head={['Sent', 'Job', 'Client', 'Connects', 'Result']} numeric={[3]}
            rows={u.proposals.slice(0, 60).map((p) => [shortDate(p.submittedAt), p.title, p.client, count(p.connects), p.hired ? 'Hired' : p.interviewed ? 'Wrote back' : p.viewed ? 'Opened' : 'Not opened'])} />
        ) : <p className="empty">No application was sent during this period.</p>}
      </Tile>
    </main>
  );
}
