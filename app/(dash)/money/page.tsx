'use client';

import { Tile, Problem } from '@/components/Tile';
import { BarList, Change, Hero, KV, Table } from '@/components/Bits';
import { Bars, Lines, C1, C2 } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, pct, plural, shortDate } from '@/lib/format';
import { channels, fixedMonthly, moneyTotals, monthly, otherMoneyIn, spendByCategory, unchannelled } from '@/lib/metrics';
import { daysBetween } from '@/lib/period';

export default function MoneyPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.ledger.ok) return <main className="page"><div className="full"><Problem text={`The P&L sheet could not be read. ${blob.ledger.error}`} /></div></main>;

  const ledger = blob.ledger.data;
  const recurring = blob.recurring.ok ? blob.recurring.data : [];
  const { channels: names, categories, taxRate } = blob.config;
  const before = period.compareStart ? { start: period.compareStart, end: period.compareEnd as string } : null;
  const span = before ? daysBetween(before.start, before.end) + 1 : 0;
  const versus = span === 1 ? 'the day before' : `the ${span} days before`;
  const m = moneyTotals(ledger, period);
  const mb = before ? moneyTotals(ledger, before) : null;
  const months = monthly(ledger, today, 6);
  const cats = spendByCategory(ledger, period).map((c) => ({ name: c.category, value: c.amount }));
  const ch = channels(ledger, period, names).filter((c) => c.inAmt || c.outAmt);
  const lost = unchannelled(ledger, names);
  const other = otherMoneyIn(ledger, categories, period);
  const fixed = fixedMonthly(recurring);
  const stripe = blob.stripe.ok ? blob.stripe.data : null;
  const rows = ledger.filter((r) => r.date >= period.start && r.date <= period.end).sort((a, b) => b.date.localeCompare(a.date));
  const label = period.label.toLowerCase();

  return (
    <main className="page">
      <Tile title="Money in" span={3} bigTitle={`Money in, ${label}`}
        big={<Table head={['Date', 'Who', 'Category', 'Channel', 'Status', 'Amount']} numeric={[5]} rows={rows.filter((r) => r.direction === 'In').map((r) => [shortDate(r.date), r.who, r.category, r.channel, r.status, money(r.amount, true)])} />}>
        <Hero value={money(m.revenueIn)} />
        <Change now={m.revenueIn} before={mb?.revenueIn} fmt={money} versus={versus} />
        <div className="sub-line">{money(m.cashCollected)} received{m.pendingIn ? `, ${money(m.pendingIn)} pending` : ''}{other.amount ? `. ${money(other.amount)} of it is a refund or other money, not a client payment` : ''}</div>
      </Tile>
      <Tile title="Money out" span={3} bigTitle={`Money out, ${label}`}
        big={<Table head={['Date', 'Who', 'Category', 'Channel', 'Amount']} numeric={[4]} rows={rows.filter((r) => r.direction === 'Out').map((r) => [shortDate(r.date), r.who, r.category, r.channel, money(r.amount, true)])} />}>
        <Hero value={money(m.costsOut)} />
        <Change now={m.costsOut} before={mb?.costsOut} fmt={money} versus={versus} lowerIsBetter />
      </Tile>
      <Tile title="Profit" span={3}>
        <Hero value={money(m.profit)} />
        <Change now={m.profit} before={mb?.profit} fmt={money} versus={versus} />
      </Tile>
      <Tile title="Margin" span={3}>
        <Hero value={m.margin === null ? 'no money in' : pct(m.margin * 100, 0)} />
        <div className="sub-line">{m.margin === null ? 'Margin needs money in to mean anything.' : 'The share of money in that is left after costs.'}</div>
      </Tile>

      <Tile title="Money in and money out, last 6 months" span={7}
        big={<Table head={['Month', 'In', 'Out', 'Profit', 'Profit so far']} numeric={[1, 2, 3, 4]} rows={months.map((x) => [x.label, money(x.inAmt), money(x.outAmt), money(x.net), money(x.running)])} />}>
        <Bars data={months} x="label" series={[{ key: 'inAmt', name: 'Money in', color: C1 }, { key: 'outAmt', name: 'Money out', color: C2 }]} tall />
      </Tile>
      <Tile title="Profit so far, added up" span={5} foot="Everything that came in minus everything that went out, since the first row.">
        <Lines data={months} x="label" series={[{ key: 'running', name: 'Profit so far', color: C1 }]} reference={{ y: 0, label: 'break even' }} tall />
      </Tile>

      <Tile title={`Each way of finding clients, ${label}`} span={7}
        foot={lost.length ? `${plural(lost.length, 'ledger row')} carry a channel outside your list (${names.join(', ')}) and count nowhere. Fix them in the sheet.` : undefined}>
        {ch.length ? (
          <Table head={['Channel', 'Money in', 'Money out', 'Left over']} numeric={[1, 2, 3]}
            rows={ch.map((c) => [c.channel, money(c.inAmt), money(c.outAmt), money(c.net)])} />
        ) : <p className="empty">No money moved during this period.</p>}
      </Tile>
      <Tile title={`Where the money went, ${label}`} span={5}>
        {cats.length ? <BarList rows={cats} fmt={money} color={C2} /> : <p className="empty">Nothing was spent during this period.</p>}
      </Tile>

      <Tile title="Good to know" span={12}>
        <div className="facts">
          <KV rows={[
            { k: 'Fixed cost each month, whether you sell or not', v: money(fixed, true) },
            ...(taxRate > 0 ? [{ k: `Tax to set aside, ${Math.round(taxRate * 100)}% of the profit above`, v: money(Math.max(0, m.profit * taxRate)) }] : []),
          ]} />
          {blob.config.connected.stripe ? (
            <KV rows={[
              { k: 'Stripe, ready to pay out', v: stripe ? money(stripe.availableCents / 100, true) : 'not read', muted: !stripe },
              { k: 'Stripe, still pending', v: stripe ? money(stripe.pendingCents / 100, true) : 'not read', muted: !stripe },
            ]} />
          ) : null}
        </div>
      </Tile>
    </main>
  );
}
