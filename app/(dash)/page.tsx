'use client';

import { Tile, Problem } from '@/components/Tile';
import { BarList, Change, Hero, Notice, Table } from '@/components/Bits';
import { Bars, C1, C2 } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, plural, shortDate } from '@/lib/format';
import { cashDates, clientList, daysSinceMoneyIn, funnel, incomeByChannel, moneyTotals, monthly, otherMoneyIn, unitEconomics, type UnitRow } from '@/lib/metrics';
import { daysBetween, inPeriod } from '@/lib/period';
import { SetupNeeded } from '@/components/NotConnected';

/** One row of the client cost table, with the two bars drawn on one shared scale. */
function UnitLine({ r, top, strong = false }: { r: UnitRow; top: number; strong?: boolean }) {
  const w = (v: number | null) => `${v === null ? 0 : Math.max(1.5, (100 * v) / top)}%`;
  return (
    <tr className={strong ? 'strong' : ''}>
      <td className="who">{r.channel}</td>
      <td className="n">{count(r.clients)}</td>
      <td className="n">{money(r.spend)}</td>
      <td className="n big">{r.cac === null ? <span className="quiet">no client yet</span> : money(r.cac)}</td>
      <td className="n big">{r.ltv === null ? <span className="quiet">no client yet</span> : money(r.ltv)}</td>
      <td className="pairbars" aria-hidden>
        <span className="track"><i style={{ width: w(r.cac), background: C2 }} /></span>
        <span className="track"><i style={{ width: w(r.ltv), background: C1 }} /></span>
      </td>
      <td className="n">{r.backPerDollar === null ? <span className="quiet">nothing spent</span> : money(r.backPerDollar, true)}</td>
    </tr>
  );
}

export default function TodayPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.config.connected.sheets && !blob.config.demo) return <SetupNeeded />;

  const ledger = blob.ledger.ok ? blob.ledger.data : [];
  const log = blob.stageLog.ok ? blob.stageLog.data : [];
  const cards = blob.cards.ok ? blob.cards.data : [];
  const { channels: names, categories } = blob.config;
  const before = period.compareStart ? { start: period.compareStart, end: period.compareEnd as string } : null;
  const span = before ? daysBetween(before.start, before.end) + 1 : 0;
  const versus = span === 1 ? 'the day before' : `the ${span} days before`;

  const m = moneyTotals(ledger, period);
  const mBefore = before ? moneyTotals(ledger, before) : null;
  const f = funnel(log, cards, period);
  const fBefore = before ? funnel(log, cards, before) : null;
  const clients = clientList(ledger, categories);
  const newClients = clients.filter((c) => inPeriod(c.first, period));
  const newBefore = before ? clients.filter((c) => inPeriod(c.first, before)).length : null;
  const unit = unitEconomics(ledger, names, categories);
  const shown = unit.rows.filter((r) => r.clients > 0 || r.spend > 0);
  const top = Math.max(...[unit.all, ...shown].flatMap((r) => [r.cac ?? 0, r.ltv ?? 0]), 0.0001);
  const months = monthly(ledger, today, 6);
  const from = incomeByChannel(ledger, period).map((x) => ({ name: x.channel, value: x.amount }));
  const cash = cashDates(ledger, period);
  const since = daysSinceMoneyIn(ledger, today);
  const other = otherMoneyIn(ledger, categories, period);
  const stageProblem = blob.stageLog.ok ? null : `The meetings could not be read. ${blob.stageLog.error}`;
  const newest = ledger.map((r) => r.date).sort().pop();
  const stale = newest ? daysBetween(newest, today) : null;

  return (
    <main className="page">
      {!blob.ledger.ok ? <div className="full"><Problem text={`The P&L sheet could not be read. ${blob.ledger.error}`} /></div> : null}
      {stale !== null && stale > 10 ? (
        <div className="full"><Notice>The newest row in the P&L sheet is from {shortDate(newest as string)}, {count(stale)} days ago. Money that came in or went out since then is not on this page yet.</Notice></div>
      ) : null}

      <Tile title="Cash collected" span={3} bigTitle={`Cash collected, ${period.label.toLowerCase()}`}
        big={<Table head={['Date', 'Who', 'Amount']} numeric={[2]} rows={cash.map((c) => [shortDate(c.date), c.who, money(c.amount, true)])} />}>
        <Hero value={money(m.cashCollected)} />
        <Change now={m.cashCollected} before={mBefore?.cashCollected} fmt={money} versus={versus} />
        {m.pendingIn ? <div className="sub-line">{money(m.pendingIn)} more is pending</div> : null}
      </Tile>
      <Tile title="Profit" span={3}>
        <Hero value={money(m.profit)} />
        <Change now={m.profit} before={mBefore?.profit} fmt={money} versus={versus} />
        <div className="sub-line">{money(m.revenueIn)} in, {money(m.costsOut)} out</div>
      </Tile>
      <Tile title="New paying clients" span={3} bigTitle={`New paying clients, ${period.label.toLowerCase()}`}
        big={<Table head={['First payment', 'Client', 'Found through', 'Paid so far']} numeric={[3]} rows={newClients.map((c) => [shortDate(c.first), c.who, c.channel, money(c.revenue, true)])} />}>
        <Hero value={count(newClients.length)} />
        <Change now={newClients.length} before={newBefore} versus={versus} />
        <div className="sub-line">{plural(clients.length, 'client')} since the start</div>
      </Tile>
      <Tile title="Meetings booked" span={3} bigTitle={`Meetings booked, ${period.label.toLowerCase()}`}
        big={<Table head={['Date', 'Who', 'Source']} rows={f.meetingCards.map((c, i) => [shortDate(f.meetingDates[i]), c.name, c.source])} />}>
        {stageProblem ? <Problem text={stageProblem} /> : <Hero value={count(f.meetings)} />}
        <Change now={f.meetings} before={fBefore?.meetings} versus={versus} />
        <div className="sub-line">{plural(f.proposals, 'proposal')} sent, {plural(f.won, 'deal')} closed</div>
      </Tile>

      <Tile title="What a client costs and what a client pays, since the start" span={12}
        foot={`CAC is everything spent on a channel, divided by the clients it brought. LTV is the cash those clients have paid so far, divided by the same clients. Overhead is left out of CAC because it is not spent to find clients.${unit.all.clients < 10 ? ` With ${plural(unit.all.clients, 'client')} these numbers still move a lot.` : ''}`}>
        <div className="table-scroll">
          <table className="unit-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="n">Clients</th>
                <th className="n">Spent</th>
                <th className="n">CAC<small>cost to win one client</small></th>
                <th className="n">LTV<small>paid by one client</small></th>
                <th><span className="legend"><span><i style={{ background: C2 }} />CAC</span><span><i style={{ background: C1 }} />LTV</span></span></th>
                <th className="n">Back<small>for each $1 spent</small></th>
              </tr>
            </thead>
            <tbody>
              <UnitLine r={unit.all} top={top} strong />
              {shown.map((r) => <UnitLine key={r.channel} r={r} top={top} />)}
            </tbody>
          </table>
        </div>
      </Tile>

      <Tile title="Money in and money out, last 6 months" span={8}
        bigTitle="Money in and money out, last 6 months"
        big={<Table head={['Month', 'In', 'Out', 'Profit', 'Profit so far']} numeric={[1, 2, 3, 4]} rows={months.map((x) => [x.label, money(x.inAmt), money(x.outAmt), money(x.net), money(x.running)])} />}>
        <Bars data={months} x="label" series={[{ key: 'inAmt', name: 'Money in', color: C1 }, { key: 'outAmt', name: 'Money out', color: C2 }]} tall />
      </Tile>
      <Tile title={`Where the money came from, ${period.label.toLowerCase()}`} span={4}
        foot={since === null ? 'No money has come in yet.' : `${since === 0 ? 'Money came in today.' : `${plural(since, 'day')} since money last came in.`}${other.amount ? ` ${money(other.amount)} of this is a refund or other money, not a client payment.` : ''}`}>
        {from.length ? <BarList rows={from} fmt={money} color={C1} /> : <p className="empty">No money came in during this period.</p>}
      </Tile>
    </main>
  );
}
