'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, Notice, RateText, Table } from '@/components/Bits';
import { Bars, C1, C2, C3, C4 } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, pct, shortDate, weekLabel } from '@/lib/format';
import { CONNECT_PRICE, THIN_SAMPLE, channelSpend, trimLeading, upworkFromDays, upworkPeriod, upworkWeekly, upworkWeeklyFromDays, type Rate } from '@/lib/metrics';
import { daysBetween } from '@/lib/period';
import { NotConnected } from '@/components/NotConnected';

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
  const old = age === null || age > 14;
  // The retrospective sheet keeps a count for every day. When the application list is an old export, those counts are the current ones.
  const days = blob.retro.ok ? blob.retro.data.days.filter((x) => x.uw_apps !== undefined) : [];
  const newestDay = days.length ? days[days.length - 1].date : null;
  const fromDays = old && newestDay !== null && (newest === null || newestDay > newest);
  const c = fromDays ? upworkFromDays(days, period) : u;
  const weeks = trimLeading(fromDays ? upworkWeeklyFromDays(days, today, 10) : upworkWeekly(v.proposals, old && newest ? newest : today, 10), (w) => w.sent > 0)
    .map((w) => ({ ...w, label: weekLabel(w.week) }));
  const spend = channelSpend(blob.ledger.ok ? blob.ledger.data : [], 'Upwork', period);
  const per = (n: number) => (n > 0 && spend > 0 ? money(spend / n) : null);
  const label = period.label.toLowerCase();
  const rateHero = (r: Rate, part: number, whole: number) => (r.pct === null ? <Hero value="none yet" small /> : <Hero value={pct(r.pct, 0)} unit={outOf(part, whole)} />);

  return (
    <main className="page">
      {fromDays ? (
        <div className="full"><Notice>The numbers and the chart come from the retrospective sheet, which is filled every day (newest day {shortDate(newestDay as string)}). The application list at the bottom is older. Its newest row is from {newest ? shortDate(newest) : 'no date'}, because it is filled from a Vollna export.</Notice></div>
      ) : old && newest ? (
        <div className="full"><Notice>The newest application on this page is from {shortDate(newest)}, {count(age as number)} days ago. Export your proposals from Vollna again to bring it up to date.</Notice></div>
      ) : null}

      <Tile title={`Applications sent, ${label}`} span={3}>
        <Hero value={count(c.sent)} />
        {!fromDays && u.withdrawn ? <div className="sub-line">{count(u.withdrawn)} withdrawn, not counted</div> : null}
        {c.sent > 0 && c.thin ? <div className="sub-line">Under {THIN_SAMPLE} applications, so the rates here still move a lot.</div> : null}
      </Tile>
      <Tile title="Opened by the client" span={3}>
        {rateHero(c.viewRate, c.viewed, c.sent)}
      </Tile>
      <Tile title="Client wrote back" span={3}>
        {rateHero(c.replyRate, c.replies, c.sent)}
        <div className="sub-line">Of the ones they opened: <RateText r={c.conversionRate} /></div>
      </Tile>
      <Tile title="Hired" span={3}>
        {rateHero(c.hireRate, c.hired, c.sent)}
        <div className="sub-line">Of the ones who wrote back: <RateText r={c.replyToHire} /></div>
      </Tile>

      <Tile title="Applications, week by week, last 10 weeks" span={8}
        big={<Table head={['Week of', 'Sent', 'Opened', 'Wrote back', 'Hired']} numeric={[1, 2, 3, 4]} rows={[...weeks].reverse().map((w) => [w.label, count(w.sent), count(w.viewed), count(w.interviewed), count(w.hired)])} />}>
        <Bars data={weeks} x="label" series={[{ key: 'sent', name: 'Sent', color: C1 }, { key: 'viewed', name: 'Opened', color: C2 }, { key: 'interviewed', name: 'Wrote back', color: C3 }, { key: 'hired', name: 'Hired', color: C4 }]} fmt={count} tall shareOf="sent" labels={false} />
      </Tile>
      {fromDays ? (
        <Tile title={`What it cost, ${label}`} span={4} foot="Every Upwork cost in the P&L sheet for this period: connects, fees and tools.">
          <KV rows={[
            { k: 'Spent on Upwork', v: spend ? money(spend) : 'nothing in the P&L yet', muted: !spend },
            { k: 'Cost for one reply', v: per(c.replies) ?? (c.replies ? 'needs the spend first' : 'no reply yet'), muted: !per(c.replies) },
            { k: 'Cost to win one client', v: per(c.hired) ?? (c.hired ? 'needs the spend first' : 'no one hired yet'), muted: !per(c.hired) },
          ]} />
        </Tile>
      ) : (
        <Tile title={`What it cost, ${label}`} span={4} foot={`Connects only, at ${money(CONNECT_PRICE, true)} each. Upwork fees are on the Money screen.`}>
          <KV rows={[
            { k: 'Connects spent', v: `${count(u.connects)}, about ${money(u.dollars)}` },
            { k: 'Cost for one reply', v: u.costPerReply === null ? 'no reply yet' : money(u.costPerReply, true), muted: u.costPerReply === null },
            { k: 'Cost to win one client', v: u.cac === null ? 'no one hired yet' : money(u.cac, true), muted: u.cac === null },
            { k: 'Connects left now', v: v.connectsBalance === null ? 'unknown' : count(v.connectsBalance), muted: v.connectsBalance === null },
          ]} />
        </Tile>
      )}

      <Tile title={fromDays ? 'Applications in the old export' : `Every application, ${label}`} span={12}>
        {(fromDays ? v.proposals : u.proposals).length ? (
          <Table head={['Sent', 'Job', 'Client', 'Connects', 'Result']} numeric={[3]}
            rows={[...(fromDays ? v.proposals : u.proposals)].sort((x, y) => y.submittedAt.localeCompare(x.submittedAt)).slice(0, fromDays ? 15 : 60).map((p) => [shortDate(p.submittedAt), p.title, p.client, count(p.connects), p.hired ? 'Hired' : p.interviewed ? 'Wrote back' : p.viewed ? 'Opened' : 'Not opened'])} />
        ) : <p className="empty">No application was sent during this period.</p>}
      </Tile>
    </main>
  );
}
