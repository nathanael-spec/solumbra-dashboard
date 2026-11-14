'use client';

import { useState } from 'react';
import { Tile, Problem } from '@/components/Tile';
import { Change, Hero, Table } from '@/components/Bits';
import { Bars, Lines, C1, C2, C3 } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, shortDate } from '@/lib/format';
import { growth, stageLogStart, type GrowthBucket, type GrowthPoint } from '@/lib/metrics';
import { SetupNeeded } from '@/components/NotConnected';

/**
 * The business over time. Every chart covers the whole history, in weeks or
 * months, and each tile leads with the newest number and how it moved.
 */
export default function GrowthPage() {
  const { blob, loading, today } = useDash();
  const [bucket, setBucket] = useState<GrowthBucket>('month');
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.config.connected.sheets && !blob.config.demo) return <SetupNeeded />;
  if (!blob.ledger.ok) return <main className="page"><div className="full"><Problem text={`The P&L sheet could not be read. ${blob.ledger.error}`} /></div></main>;

  const log = blob.stageLog.ok ? blob.stageLog.data : [];
  const rows = growth(blob.ledger.data, log, blob.config.categories, today, bucket);
  if (!rows.length) return <main className="page"><div className="full"><p className="empty">Nothing recorded yet. This page fills in once the P&L sheet has its first row.</p></div></main>;

  const unit = bucket === 'month' ? 'month' : 'week';
  const now = rows[rows.length - 1];
  const prev: GrowthPoint | undefined = rows[rows.length - 2];
  const soFar = `this ${unit} so far`;
  const periodName = prev ? (bucket === 'month' ? prev.label : `the week of ${prev.label}`) : '';
  const versus = `all of ${periodName}`;
  const started = stageLogStart(log);
  const table = (head: string[], pick: (r: GrowthPoint) => (string | number)[], numeric: number[]) =>
    <Table head={[bucket === 'month' ? 'Month' : 'Week of', ...head]} numeric={numeric} rows={[...rows].reverse().map((r) => [r.label, ...pick(r)])} />;
  const dollars = (v: number | null) => (v === null ? '' : money(v));

  return (
    <main className="page">
      <div className="full page-bar">
        <p className="lead">From {shortDate(rows[0].start)} to today. The last point on every chart is {soFar}, so it is still filling up.</p>
        <div className="segment" role="group" aria-label="Group the charts by">
          <button className={bucket === 'month' ? 'on' : ''} aria-pressed={bucket === 'month'} onClick={() => setBucket('month')}>By month</button>
          <button className={bucket === 'week' ? 'on' : ''} aria-pressed={bucket === 'week'} onClick={() => setBucket('week')}>By week</button>
        </div>
      </div>

      <Tile title="All the money that has come in, added up" span={6} big={table(['Came in', 'Total so far'], (r) => [money(r.moneyIn), money(r.inToDate)], [1, 2])}>
        <Hero value={money(now.inToDate)} unit="in total" />
        <div className="sub-line">{money(now.moneyIn)} {soFar}{prev ? `, ${money(prev.moneyIn)} in ${versus}` : ''}</div>
        <Lines data={rows} x="label" series={[{ key: 'inToDate', name: 'Total money in', color: C1 }]} area tall />
      </Tile>
      <Tile title={`Money in and money out, each ${unit}`} span={6} big={table(['In', 'Out', 'Profit'], (r) => [money(r.moneyIn), money(r.moneyOut), money(r.profit)], [1, 2, 3])}>
        <Hero value={money(now.profit)} unit={`profit ${soFar}`} />
        <div className="sub-line">{money(now.moneyIn)} in and {money(now.moneyOut)} out {soFar}{prev ? `. ${money(prev.profit)} profit in ${versus}` : ''}</div>
        <Bars data={rows} x="label" series={[{ key: 'moneyIn', name: 'Money in', color: C1 }, { key: 'moneyOut', name: 'Money out', color: C2 }]} tall />
      </Tile>

      <Tile title={`Meetings booked, each ${unit}`} span={6}
        foot={!blob.stageLog.ok ? `The meetings could not be read. ${blob.stageLog.error}` : started ? `Counted from the stage log, which starts on ${shortDate(started)}. Meetings before that day were not recorded.` : 'No meeting has been recorded yet.'}
        big={table(['Meetings', 'Proposals', 'Deals closed'], (r) => [count(r.meetings), count(r.proposals), count(r.deals)], [1, 2, 3])}>
        <Hero value={count(now.meetings)} unit={soFar} />
        <div className="sub-line">{prev ? `${count(prev.meetings)} in ${versus}` : 'The first period on record.'}</div>
        <Bars data={rows} x="label" series={[{ key: 'meetings', name: 'Meetings booked', color: C3 }]} fmt={count} tall />
      </Tile>
      <Tile title={`New paying clients, each ${unit}`} span={6} foot="A client is counted once, in the period of their first payment."
        big={table(['New clients', 'Clients so far'], (r) => [count(r.newClients), count(r.clientsToDate)], [1, 2])}>
        <Hero value={count(now.clientsToDate)} unit="clients in total" />
        <div className="sub-line">{count(now.newClients)} new {soFar}{prev ? `, ${count(prev.newClients)} in ${versus}` : ''}</div>
        <Bars data={rows} x="label" series={[{ key: 'newClients', name: 'New paying clients', color: C3 }]} fmt={count} tall />
      </Tile>

      <Tile title="What a client costs (CAC) and what a client pays (LTV)" span={6}
        foot="Both lines are to date: everything spent to find clients, and everything clients have paid, divided by every client won by then. You want the blue line above the orange one, and the gap growing."
        big={table(['CAC', 'LTV', 'Clients so far'], (r) => [dollars(r.cac), dollars(r.ltv), count(r.clientsToDate)], [1, 2, 3])}>
        <Hero value={now.ltv === null ? 'no client yet' : money(now.ltv)} unit={now.cac === null ? undefined : `LTV, against ${money(now.cac)} CAC`} />
        {prev && now.cac !== null && prev.cac !== null ? <Change now={now.cac} before={prev.cac} fmt={(n) => `CAC ${money(n)}`} versus={`at the end of ${periodName}`} lowerIsBetter /> : null}
        <Lines data={rows} x="label" series={[{ key: 'ltv', name: 'LTV, paid by one client', color: C1 }, { key: 'cac', name: 'CAC, cost to win one client', color: C2 }]} tall />
      </Tile>
      <Tile title="Profit, added up" span={6} foot="Everything that came in, minus everything that went out, since the first row."
        big={table(['Profit', 'Profit so far'], (r) => [money(r.profit), money(r.profitToDate)], [1, 2])}>
        <Hero value={money(now.profitToDate)} unit="so far" />
        <Change now={now.profitToDate} before={prev?.profitToDate} fmt={money} versus={`at the end of ${periodName}`} />
        <Lines data={rows} x="label" series={[{ key: 'profitToDate', name: 'Profit so far', color: C1 }]} reference={{ y: 0, label: 'break even' }} tall />
      </Tile>
    </main>
  );
}
