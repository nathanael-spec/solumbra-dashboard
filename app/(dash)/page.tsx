'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, RateText, Table } from '@/components/Bits';
import { Spark, Bars, Lines } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, plural, weekLabel, shortDate } from '@/lib/format';
import { bookingsIn, cashDates, cashFromWon, daysSinceMoneyIn, daysSinceNewPerson, funnel, mailboxHealth, moneyTotals, openCards, rate, waitingOnYou, weekly, delta } from '@/lib/metrics';
import { weeksToShow } from '@/lib/period';
import { SetupNeeded } from '@/components/NotConnected';

/** "Sep 2, Sep 8 and Sep 12", or "none in this period". */
function dateList(dates: string[]): string {
  if (!dates.length) return 'none in this period';
  const uniq = [...new Set(dates)].map(shortDate);
  if (uniq.length <= 4) return uniq.length === 1 ? uniq[0] : uniq.slice(0, -1).join(', ') + ' and ' + uniq[uniq.length - 1];
  return `${uniq.slice(0, 3).join(', ')} and ${uniq.length - 3} more, last ${uniq[uniq.length - 1]}`;
}

export default function TodayPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.config.connected.sheets && !blob.config.demo) return <SetupNeeded />;

  const ledger = blob.ledger.ok ? blob.ledger.data : [];
  const log = blob.stageLog.ok ? blob.stageLog.data : [];
  const cards = blob.cards.ok ? blob.cards.data : [];
  const f = funnel(log, cards, period);
  const before = period.compareStart ? funnel(log, cards, { start: period.compareStart, end: period.compareEnd as string }) : null;
  const m = moneyTotals(ledger, period);
  const mBefore = period.compareStart ? moneyTotals(ledger, { start: period.compareStart, end: period.compareEnd as string }) : null;
  const weeks = weekly(log, ledger, today, weeksToShow(period, today)).map((w) => ({ ...w, label: weekLabel(w.week) }));
  const cash = cashDates(ledger, period);
  const booked = blob.bookings.ok ? bookingsIn(blob.bookings.data, period).length : null;
  const waiting = waitingOnYou(cards, today);
  const mail = blob.instantly.ok ? mailboxHealth(blob.instantly.data) : null;
  const sending = blob.instantly.ok ? blob.instantly.data.campaigns.filter((c) => c.sendsToday).length : null;
  const campaignsTotal = blob.instantly.ok ? blob.instantly.data.campaigns.length : 0;
  const quiet = blob.instantly.ok ? daysSinceNewPerson(blob.instantly.data, today) : null;
  const wonCash = cashFromWon(ledger, f.wonCards, period);
  const since = daysSinceMoneyIn(ledger, today);
  const d = (now: number, prev: number | null, fmt?: (n: number) => string) => delta(now, prev, fmt)?.text ?? '';
  const stageProblem = blob.stageLog.ok ? null : `Stage log not read. ${blob.stageLog.error}`;
  const on = blob.config.connected;

  const rows = (xs: { name: string; source: string; dealValue: number | null }[], dates: string[]) =>
    xs.map((c, i) => [shortDate(dates[i]), c.name, c.source, c.dealValue === null ? '' : money(c.dealValue)]);

  return (
    <main className="page">
      <Tile title="Meetings booked" span={3} foot={dateList(f.meetingDates)} bigTitle={`Meetings booked, ${period.label.toLowerCase()}`}
        big={<><Bars data={weeks} x="label" series={[{ key: 'meetings', name: 'Meetings booked' }]} fmt={count} tall /><Table head={['Date', 'Who', 'Source', '']} rows={rows(f.meetingCards, f.meetingDates)} /></>}>
        {stageProblem ? <Problem text={stageProblem} /> : <Hero value={count(f.meetings)} />}
        <Spark data={weeks} x="label" y="meetings" />
        <div className="sub-line">{d(f.meetings, before?.meetings ?? null)}</div>
      </Tile>
      <Tile title="Proposals sent" span={3} foot={dateList(f.proposalDates)} bigTitle={`Proposals sent, ${period.label.toLowerCase()}`}
        big={<><Bars data={weeks} x="label" series={[{ key: 'proposals', name: 'Proposals sent' }]} fmt={count} tall /><Table head={['Date', 'Who', 'Source', '']} rows={rows(f.proposalCards, f.proposalDates)} /></>}>
        {stageProblem ? <Problem text={stageProblem} /> : <Hero value={count(f.proposals)} />}
        <Spark data={weeks} x="label" y="proposals" />
        <div className="sub-line">{d(f.proposals, before?.proposals ?? null)}</div>
      </Tile>
      <Tile title="Deals closed" span={3} foot={dateList(f.wonDates)} bigTitle={`Deals closed, ${period.label.toLowerCase()}`}
        big={<><Bars data={weeks} x="label" series={[{ key: 'won', name: 'Deals closed' }]} fmt={count} tall /><Table head={['Date', 'Who', 'Source', 'Deal value']} numeric={[3]} rows={rows(f.wonCards, f.wonDates)} /></>}>
        {stageProblem ? <Problem text={stageProblem} /> : <Hero value={count(f.won)} />}
        <Spark data={weeks} x="label" y="won" />
        <div className="sub-line">{f.won ? `${money(f.wonValue)} in deal value on the cards` : d(f.won, before?.won ?? null)}</div>
      </Tile>
      <Tile title="Cash collected" span={3} foot={dateList(cash.map((c) => c.date))} bigTitle={`Cash collected, ${period.label.toLowerCase()}`}
        big={<><Bars data={weeks} x="label" series={[{ key: 'cash', name: 'Cash collected' }]} tall /><Table head={['Date', 'Who', 'Amount']} numeric={[2]} rows={cash.map((c) => [shortDate(c.date), c.who, money(c.amount, true)])} /></>}>
        {blob.ledger.ok ? <Hero value={money(m.cashCollected)} /> : <Problem text={`P&L sheet not read. ${blob.ledger.error}`} />}
        <Spark data={weeks} x="label" y="cash" fmt={money} />
        <div className="sub-line">{m.pendingIn ? `${money(m.pendingIn)} more is pending` : d(m.cashCollected, mBefore?.cashCollected ?? null, money)}</div>
      </Tile>

      <Tile title="Week by week" span={6}
        bigTitle="Week by week"
        big={<><Bars data={weeks} x="label" series={[{ key: 'meetings', name: 'Meetings' }, { key: 'proposals', name: 'Proposals' }, { key: 'won', name: 'Deals' }]} fmt={count} tall /><Lines data={weeks} x="label" series={[{ key: 'cash', name: 'Cash collected' }]} tall /></>}>
        <Bars data={weeks} x="label" series={[{ key: 'meetings', name: 'Meetings' }, { key: 'proposals', name: 'Proposals' }, { key: 'won', name: 'Deals' }]} fmt={count} />
      </Tile>

      <Tile title="Funnel rates" span={3}>
        <KV rows={[
          { k: 'Meeting to proposal', v: <RateText r={rate(f.proposals, f.meetings)} /> },
          { k: 'Proposal to close', v: <RateText r={rate(f.won, f.proposals)} /> },
          { k: `Won ${count(f.won)}, lost ${count(f.lost)}`, v: <RateText r={rate(f.won, f.won + f.lost)} /> },
          { k: 'Cash per closed deal', v: f.won ? money(wonCash / f.won) : 'none yet', muted: !f.won },
        ]} />
      </Tile>

      <Tile title="Needs you" span={3}>
        <KV rows={[
          ...(on.pipeline ? [
            { k: 'Open cards on the board', v: count(openCards(cards).length), muted: !!openCards(cards).length },
            { k: 'Follow ups due', v: blob.cards.ok ? count(waiting.length) : 'pipeline not read', muted: !waiting.length },
          ] : []),
          ...(on.instantly ? [
            { k: 'Campaigns sending today', v: sending === null ? 'Instantly not read' : `${count(sending)} of ${count(campaignsTotal)}`, muted: !!sending },
            { k: 'Days since a new person was emailed', v: quiet === null ? 'never' : count(quiet), muted: quiet !== null && quiet <= 1 },
            { k: 'Mailboxes not sending', v: mail ? count(mail.notSending.length) : '', muted: !mail?.notSending.length },
          ] : []),
          { k: 'Days since money came in', v: since === null ? 'never' : count(since) },
          ...(on.calcom ? [{ k: 'Booked on the site', v: booked === null ? '' : count(booked), muted: !booked }] : []),
        ]} />
        {waiting.slice(0, 3).map((c) => (
          <a key={c.id} className="card" href={c.url} target="_blank" rel="noreferrer">{c.name}<div className="c2">due {c.dueDate?.slice(0, 10)}</div></a>
        ))}
      </Tile>
    </main>
  );
}
