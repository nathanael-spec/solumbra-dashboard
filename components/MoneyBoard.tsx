'use client';

import { Tile, Problem } from '@/components/Tile';
import { BarList, Change, Hero, KV, Table } from '@/components/Bits';
import { Bars, Lines, C1, C2, C3 } from '@/components/Charts';
import { money, plural, setCurrency, shortDate } from '@/lib/format';
import { channels, clientList, fixedMonthly, moneyTotals, monthly, otherMoneyIn, spendByCategory, trimLeading, unchannelled, unitEconomics } from '@/lib/metrics';
import { pipelineValue, upcomingCharges } from '@/lib/money';
import { STAGE_TITLE } from '@/lib/stages';
import type { Blob } from '@/lib/types';

export type BoardPeriod = { key: string; label: string; start: string; end: string; compareStart?: string; compareEnd?: string };

/**
 * The money board shown inside ClickUp. Only money: what came in, what went
 * out, what is left, where it came from, what it costs to win a client, what
 * is charged next, and what the pipeline is worth. Marketing numbers live on
 * their own board.
 */
export function MoneyBoard({ blob, period, periods, today, token }: {
  blob: Blob; period: BoardPeriod; periods: { key: string; label: string }[]; today: string; token: string;
}) {
  setCurrency(blob.config.currency);
  if (!blob.ledger.ok) {
    return <main className="page"><div className="full"><Problem text={`The P&L sheet could not be read. ${blob.ledger.error}`} /></div></main>;
  }
  const ledger = blob.ledger.data;
  const recurring = blob.recurring.ok ? blob.recurring.data : [];
  const { channels: names, categories } = blob.config;
  const label = period.label.toLowerCase();
  const before = period.compareStart && period.compareEnd ? { start: period.compareStart, end: period.compareEnd } : null;
  const versus = 'the same stretch before';

  const m = moneyTotals(ledger, period);
  const mb = before ? moneyTotals(ledger, before) : null;
  const other = otherMoneyIn(ledger, categories, period);
  const months = trimLeading(monthly(ledger, today, 12), (x) => x.inAmt > 0 || x.outAmt > 0);
  const ch = channels(ledger, period, names).filter((c) => c.inAmt || c.outAmt);
  const lost = unchannelled(ledger, names);
  const cats = spendByCategory(ledger, period).map((c) => ({ name: c.category, value: c.amount }));
  const unit = unitEconomics(ledger, names, categories);
  const unitRows = unit.rows.filter((u) => u.clients || u.spend);
  const clients = clientList(ledger, categories).sort((a, b) => b.revenue - a.revenue);

  const charges = upcomingCharges(recurring, today);
  const in30 = new Date(Date.parse(today + 'T00:00:00Z') + 30 * 864e5).toISOString().slice(0, 10);
  const soon = charges.filter((c) => c.due <= in30);
  const soonTotal = soon.reduce((s, c) => s + c.amount, 0);
  const fixed = fixedMonthly(recurring);

  const cards = blob.cards.ok ? blob.cards.data : null;
  const stages = cards ? pipelineValue(cards) : [];
  const open = stages.filter((s) => s.stage === 'intake' || s.stage === 'meeting booked' || s.stage === 'proposal sent');
  const openValue = open.reduce((s, x) => s + x.value, 0);
  const won = stages.find((s) => s.stage === 'closed won');

  const read = new Date(blob.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: blob.config.timezone || undefined });
  const rows = ledger.filter((r) => r.date >= period.start && r.date <= period.end).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="page board">
      <header className="full board-bar">
        <div>
          <h1 className="board-title">Solumbra money.</h1>
          <p className="board-lead">From the P&amp;L sheet, read at {read}. Refreshes every 5 minutes.</p>
        </div>
        <nav className="board-periods" aria-label="Period">
          {periods.map((p) => (
            <a key={p.key} href={`?k=${encodeURIComponent(token)}&p=${p.key}`} aria-current={p.key === period.key ? 'page' : undefined}>{p.label}</a>
          ))}
        </nav>
      </header>

      <Tile title="Money in" span={3} bigTitle={`Money in, ${label}`}
        big={<Table head={['Date', 'Who', 'Category', 'Channel', 'Status', 'Amount']} numeric={[5]} rows={rows.filter((r) => r.direction === 'In').map((r) => [shortDate(r.date), r.who, r.category, r.channel, r.status, money(r.amount, true)])} />}>
        <Hero value={money(m.revenueIn)} />
        {mb ? <Change now={m.revenueIn} before={mb.revenueIn} fmt={money} versus={versus} /> : null}
        <div className="sub-line">{money(m.cashCollected)} received{m.pendingIn ? `, ${money(m.pendingIn)} still pending` : ''}.{other.amount ? ` ${money(other.amount)} of it is a refund, not a client.` : ''}</div>
      </Tile>
      <Tile title="Money out" span={3} bigTitle={`Money out, ${label}`}
        big={<Table head={['Date', 'Who', 'Category', 'Channel', 'Amount']} numeric={[4]} rows={rows.filter((r) => r.direction === 'Out').map((r) => [shortDate(r.date), r.who, r.category, r.channel, money(r.amount, true)])} />}>
        <Hero value={money(m.costsOut)} />
        {mb ? <Change now={m.costsOut} before={mb.costsOut} fmt={money} versus={versus} lowerIsBetter /> : null}
        <div className="sub-line">{money(fixed)} of it repeats every month.</div>
      </Tile>
      <Tile title="Profit" span={3}>
        <Hero value={money(m.profit)} />
        {mb ? <Change now={m.profit} before={mb.profit} fmt={money} versus={versus} /> : null}
        <div className="sub-line">Money in minus money out.</div>
      </Tile>
      <Tile title="Margin" span={3}>
        <Hero value={m.margin === null ? 'none yet' : `${Math.round(m.margin * 100)}%`} small={m.margin === null} />
        <div className="sub-line">{m.margin === null ? 'Margin needs money in first.' : 'Of every dollar in, what is left after costs.'}</div>
      </Tile>

      <Tile title="Money in and money out, each month" span={7}
        big={<Table head={['Month', 'In', 'Out', 'Profit', 'Profit so far']} numeric={[1, 2, 3, 4]} rows={months.map((x) => [x.label, money(x.inAmt), money(x.outAmt), money(x.net), money(x.running)])} />}>
        <Bars data={months} x="label" series={[{ key: 'inAmt', name: 'Money in', color: C1 }, { key: 'outAmt', name: 'Money out', color: C2 }]} tall />
      </Tile>
      <Tile title="Profit so far, added up" span={5} foot="Everything in minus everything out, since the first row.">
        <Lines data={months} x="label" series={[{ key: 'running', name: 'Profit so far', color: C3 }]} reference={{ y: 0, label: 'break even' }} tall />
      </Tile>

      <Tile title={`Money by channel, ${label}`} span={7}
        foot={lost.length ? `${plural(lost.length, 'ledger row')} carry a channel outside the list and count nowhere. Fix them in the sheet.` : 'The channel is how the client found Solumbra. Overhead is cost that finds no one.'}>
        {ch.length ? (
          <>
            <Bars data={ch.map((c) => ({ ...c }))} x="channel" series={[{ key: 'inAmt', name: 'Money in', color: C1 }, { key: 'outAmt', name: 'Money out', color: C2 }]} />
            <Table head={['Channel', 'Money in', 'Money out', 'Left over']} numeric={[1, 2, 3]} rows={ch.map((c) => [c.channel, money(c.inAmt), money(c.outAmt), money(c.net)])} />
          </>
        ) : <p className="empty">No money moved in this period.</p>}
      </Tile>
      <Tile title="Cost to win a client, all time" span={5}
        foot="CAC is what the channel cost, split over the clients it brought. LTV is what those clients paid, on average.">
        {unitRows.length ? (
          <>
          <Bars data={unitRows.filter((u) => u.clients).map((u) => ({ channel: u.channel, cac: Math.round(u.cac ?? 0), ltv: Math.round(u.ltv ?? 0) }))} x="channel"
            series={[{ key: 'ltv', name: 'LTV, paid per client', color: C1 }, { key: 'cac', name: 'CAC, cost per client', color: C2 }]} />
          <Table head={['Channel', 'Clients', 'CAC', 'LTV', 'Back per $1']} numeric={[1, 2, 3, 4]}
            rows={[...unitRows, unit.all].map((u) => [u.channel, String(u.clients), u.cac === null ? 'no client yet' : money(u.cac), u.ltv === null ? '' : money(u.ltv), u.backPerDollar === null ? '' : money(u.backPerDollar, true)])} />
          </>
        ) : <p className="empty">No paying client yet.</p>}
      </Tile>

      <Tile title="Charged next" span={7}
        foot={`${money(fixed, true)} a month in fixed costs. ${soon.length ? `${money(soonTotal, true)} is due in the next 30 days.` : 'Nothing is due in the next 30 days.'}`}>
        {charges.length ? (
          <Table head={['Next charge', 'What', 'How often', 'Amount']} numeric={[3]}
            rows={charges.map((c) => [
              <span key="d" className={c.due <= in30 ? 'due-soon' : 'quiet'}>{shortDate(c.due)}</span>,
              c.item, `Every ${c.every}`, money(c.amount, true),
            ])} />
        ) : <p className="empty">No recurring costs in the sheet.</p>}
      </Tile>
      <Tile title={`Where the money went, ${label}`} span={5}>
        {cats.length ? <BarList rows={cats} fmt={money} color={C2} /> : <p className="empty">Nothing was spent in this period.</p>}
      </Tile>

      <Tile title="Pipeline value by stage" span={7}
        foot={cards ? `Deal value from the ClickUp CRM. ${money(openValue)} is still open across intake, meetings and proposals.` : undefined}>
        {cards ? (
          <>
            <BarList rows={stages.map((s) => ({ name: `${STAGE_TITLE[s.stage]}, ${plural(s.cards, 'deal')}`, value: s.value }))} fmt={money} color={C1} />
            {stages.some((s) => s.unpriced) ? <p className="sub-line board-note">{plural(stages.reduce((n, s) => n + s.unpriced, 0), 'deal')} {stages.reduce((n, s) => n + s.unpriced, 0) === 1 ? 'has' : 'have'} no Deal value yet, so {stages.reduce((n, s) => n + s.unpriced, 0) === 1 ? 'it counts' : 'they count'} as zero.</p> : null}
          </>
        ) : <Problem text={`The ClickUp CRM could not be read. ${blob.cards.ok ? '' : blob.cards.error ?? ''}`} />}
      </Tile>
      <Tile title="What each client has paid" span={5}
        foot={won ? `${plural(clients.length, 'paying client')} so far. ${money(won.value)} in won deals on the CRM.` : `${plural(clients.length, 'paying client')} so far.`}>
        {clients.length ? (
          <KV rows={clients.slice(0, 8).map((c) => ({ k: `${c.who}, ${c.channel}`, v: money(c.revenue, true) }))} />
        ) : <p className="empty">No paying client yet.</p>}
      </Tile>
    </main>
  );
}
