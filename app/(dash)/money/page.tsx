'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, Table } from '@/components/Bits';
import { Bars, HBars, Lines } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, pct, count, plural, shortDate } from '@/lib/format';
import { channelEconomics, channels, fixedMonthly, incomeByChannel, ltv, ltvByChannel, moneyTotals, monthly, spendByCategory, unchannelled } from '@/lib/metrics';
import { channelOf } from '@/lib/stages';

export default function MoneyPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.ledger.ok) {
    return <main className="page rows-3"><Tile title="Money" span={12}><Problem text={`The P&L sheet could not be read. ${blob.ledger.error}`} /></Tile></main>;
  }
  const ledger = blob.ledger.data;
  const recurring = blob.recurring.ok ? blob.recurring.data : [];
  const cards = blob.cards.ok ? blob.cards.data : [];
  const log = blob.stageLog.ok ? blob.stageLog.data : [];
  const m = moneyTotals(ledger, period);
  const months = monthly(ledger, today, 6);
  const names = blob.config.channels;
  const cats = spendByCategory(ledger, period);
  const from = incomeByChannel(ledger, period);
  const ch = channels(ledger, period, names);
  const eco = channelEconomics(ledger, log, cards, period, names, (src) => channelOf(src, names));
  const l = ltv(ledger);
  const lc = ltvByChannel(ledger, names);
  const fixed = fixedMonthly(recurring);
  const lost = unchannelled(ledger, names);
  const taxRate = blob.config.taxRate;
  const stripe = blob.stripe.ok ? blob.stripe.data : null;
  const rows = ledger.filter((r) => r.date >= period.start && r.date <= period.end).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="page rows-3">
      <Tile title="Revenue in" span={3} short>
        <Hero value={money(m.revenueIn)} small />
        <div className="sub-line">{money(m.cashCollected)} received, {money(m.pendingIn)} pending</div>
      </Tile>
      <Tile title="Costs out" span={3} short><Hero value={money(m.costsOut)} small /></Tile>
      <Tile title="Profit" span={3} short><Hero value={money(m.profit)} small /></Tile>
      <Tile title="Margin" span={3} short>
        <Hero value={m.margin === null ? 'no revenue yet' : pct(m.margin * 100)} small />
      </Tile>

      <Tile title="Money in and out, month by month" span={3} bigTitle="Money in and out, six months"
        big={<><Bars data={months} x="label" series={[{ key: 'inAmt', name: 'In' }, { key: 'outAmt', name: 'Out' }]} tall />
          <Table head={['Month', 'In', 'Out', 'Net', 'Profit to date']} numeric={[1, 2, 3, 4]} rows={months.map((x) => [x.label, money(x.inAmt), money(x.outAmt), money(x.net), money(x.running)])} /></>}>
        <Bars data={months} x="label" series={[{ key: 'inAmt', name: 'In' }, { key: 'outAmt', name: 'Out' }]} />
      </Tile>
      <Tile title="Profit, running total" span={3} big={<Lines data={months} x="label" series={[{ key: 'running', name: 'Profit to date' }]} tall reference={{ y: 0, label: 'break even' }} />}>
        <Lines data={months} x="label" series={[{ key: 'running', name: 'Profit to date' }]} reference={{ y: 0, label: 'break even' }} />
      </Tile>
      <Tile title="Where the money came from" span={3}
        big={<><HBars data={from} name="channel" value="amount" tall /><Table head={['Date', 'Who', 'Category', 'Channel', 'Status', 'Amount']} numeric={[5]} rows={rows.filter((r) => r.direction === 'In').map((r) => [shortDate(r.date), r.who, r.category, r.channel, r.status, money(r.amount, true)])} /></>}>
        {from.length ? <HBars data={from} name="channel" value="amount" /> : <p className="empty">No money in this period.</p>}
      </Tile>
      <Tile title="Where the money went" span={3}
        big={<><HBars data={cats} name="category" value="amount" tall /><Table head={['Date', 'Who', 'Category', 'Channel', 'Amount']} numeric={[4]} rows={rows.filter((r) => r.direction === 'Out').map((r) => [shortDate(r.date), r.who, r.category, r.channel, money(r.amount, true)])} /></>}>
        {cats.length ? <HBars data={cats} name="category" value="amount" /> : <p className="empty">No spend in this period.</p>}
      </Tile>

      <Tile title="Every way of finding clients, side by side" span={6} foot={lost.length ? `${plural(lost.length, 'ledger row')} carry a channel outside your list (${names.join(', ')}) and count nowhere. Fix them in the sheet.` : undefined}
        big={<Table head={['Channel', 'Money in', 'Money out', 'Net', 'Cost per $1 in', 'Spend per meeting', 'Spend per client']} numeric={[1, 2, 3, 4, 5, 6]}
          rows={ch.map((c) => { const e = eco.find((x) => x.channel === c.channel); return [c.channel, money(c.inAmt), money(c.outAmt), money(c.net), c.costPerDollar === null ? '' : money(c.costPerDollar, true), e?.costPerMeeting == null ? (e ? `no meeting yet, ${money(e.spend)} spent` : '') : money(e.costPerMeeting), e?.cac == null ? (e ? 'no client yet' : '') : money(e.cac)]; })} />}>
        <Table head={['Channel', 'In', 'Out', 'Net', 'Per $1 in']} numeric={[1, 2, 3, 4]}
          rows={ch.filter((c) => c.channel !== 'Overhead').map((c) => [c.channel, money(c.inAmt), money(c.outAmt), money(c.net), c.costPerDollar === null ? '' : money(c.costPerDollar, true)])} />
      </Tile>
      <Tile title="What a client is worth, what one costs" span={3}>
        <KV rows={[
          { k: `LTV, all channels, ${plural(l.clients, 'client')}`, v: l.perClient === null ? 'none yet' : money(l.perClient) },
          ...lc.filter((x) => x.clients > 0 || (eco.find((e) => e.channel === x.channel)?.spend ?? 0) > 0).flatMap((x) => {
            const e = eco.find((y) => y.channel === x.channel);
            return [
              { k: `LTV, ${x.channel}, ${plural(x.clients, 'client')}`, v: x.perClient === null ? 'no client yet' : money(x.perClient), muted: x.perClient === null },
              { k: `CAC, ${x.channel}`, v: e?.cac == null ? (e?.spend ? `no client yet, ${money(e.spend)} spent` : 'no spend') : money(e.cac), muted: e?.cac == null },
              ...(e?.cac && x.perClient ? [{ k: `LTV to CAC, ${x.channel}`, v: `${(x.perClient / e.cac).toFixed(1)} to 1` }] : []),
            ];
          }),
        ]} />
      </Tile>
      <Tile title="Every month, whether you sell or not" span={3}>
        <KV rows={[
          { k: 'Fixed cost each month', v: money(fixed, true) },
          ...(taxRate > 0 ? [{ k: `Tax to set aside, ${Math.round(taxRate * 100)}%`, v: money(Math.max(0, m.profit * taxRate)) }] : []),
          { k: 'Cost per dollar earned', v: m.revenueIn ? money(m.costsOut / m.revenueIn, true) : 'no revenue yet', muted: !m.revenueIn },
          ...(blob.config.connected.stripe ? [
            { k: 'Stripe available', v: stripe ? money(stripe.availableCents / 100, true) : 'not read', muted: !stripe },
            { k: 'Stripe pending', v: stripe ? money(stripe.pendingCents / 100, true) : 'not read', muted: !stripe },
          ] : []),
        ]} />
      </Tile>
    </main>
  );
}
