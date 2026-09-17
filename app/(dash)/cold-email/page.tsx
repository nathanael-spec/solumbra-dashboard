'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, RateText, Table } from '@/components/Bits';
import { Bars, Lines } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { money, count, pct, shortDate, plural } from '@/lib/format';
import { emailAllTime, emailPeriod, latestRun, mailboxHealth, rate, runsTotals } from '@/lib/metrics';
import { NotConnected } from '@/components/NotConnected';

export default function ColdEmailPage() {
  const { blob, loading, period } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.instantly.ok && blob.instantly.off) return <NotConnected tool="Instantly" how="Run npm run setup and paste your Instantly API key." />;
  if (!blob.instantly.ok) return <main className="page rows-3"><Tile title="Cold email" span={12}><Problem text={`Instantly could not be read. ${blob.instantly.error}`} /></Tile></main>;
  const d = blob.instantly.data;
  const runs = blob.runs.ok ? blob.runs.data : [];
  const p = emailPeriod(d, period);
  const all = emailAllTime(d);
  const mail = mailboxHealth(d);
  const last = latestRun(runs);
  const rt = runsTotals(runs);
  const sentToday = d.campaigns.reduce((s, c) => s + c.sentToday, 0);
  const halted = d.campaigns.filter((c) => c.status === -2).length;
  const chip = (label: string) => label.replace('halted by bounce protection', 'halted').replace('completed, follow ups only', 'done, follow ups');
  const expected = Math.round(d.ceiling * d.windowShare);
  const daily = d.daily.slice(-14).map((x) => ({ ...x, label: shortDate(x.date) }));
  const humanRate = rate(p.humanReplies, p.people, 50);
  const runRows = [...runs].sort((a, b) => b.run.localeCompare(a.run)).map((r) => ({ ...r, label: shortDate(r.run) }));

  return (
    <main className="page rows-3">
      <Tile title="Sent today" span={3} short>
        <Hero value={count(sentToday)} small unit={`of ${count(d.ceiling || d.mailboxCeiling)}`} />
        <div className="sub-line">{halted ? `${count(halted)} of ${count(d.campaigns.length)} campaigns halted by bounces` : d.ceiling && d.windowOpen ? `about ${count(expected)} expected by now` : `${count(d.campaigns.filter((c) => c.sendsToday).length)} of ${count(d.campaigns.length)} campaigns sending today`}</div>
      </Tile>
      <Tile title={last ? 'Bounce rate, last run' : 'Bounce rate, all time'} span={3} short>
        <Hero value={pct(last ? last.bouncePct : (all.bounceRate.pct ?? 0))} small unit={last ? `${count(last.bounced)} of ${count(last.sent)}` : `${count(all.bounced)} of ${count(all.sent)}`} />
        {last ? <div className="sub-line">all time {pct(all.bounceRate.pct ?? 0)}, {count(all.bounced)} of {count(all.sent)}</div> : null}
      </Tile>
      <Tile title="Human replies" span={3} short>
        <Hero value={humanRate.pct === null ? `${count(p.humanReplies)}` : pct(humanRate.pct)} small unit={humanRate.pct === null ? `of ${count(p.people)} people` : `${count(p.humanReplies)} of ${count(p.people)} people`} />
      </Tile>
      <Tile title="Positive replies and calls" span={3} short>
        <Hero value={count(rt.positive)} small unit="positive" />
        <div className="sub-line">{count(rt.calls)} calls booked</div>
      </Tile>

      <Tile title="Last 14 days, emails and people" span={5} big={<Lines data={d.daily.map((x) => ({ ...x, label: shortDate(x.date) }))} x="label" series={[{ key: 'sent', name: 'Emails sent' }, { key: 'newPeople', name: 'New people' }, { key: 'replies', name: 'Human replies' }]} fmt={count} tall />} bigTitle="Last 90 days, emails and people">
        <Lines data={daily} x="label" series={[{ key: 'sent', name: 'Emails sent' }, { key: 'newPeople', name: 'New people' }]} fmt={count} />
      </Tile>
      <Tile title="Campaigns" span={7}
        big={<Table head={['Campaign', 'State', 'Limit a day', 'People', 'Sent', 'Bounced', 'Bounce %', 'Human replies', 'Leads loaded']} numeric={[2, 3, 4, 5, 6, 7, 8]}
          rows={d.campaigns.map((c) => [c.name, c.statusLabel, count(c.dailyLimit), count(c.peopleAllTime), count(c.sentAllTime), count(c.bouncedAllTime), pct(c.sentAllTime ? (100 * c.bouncedAllTime) / c.sentAllTime : 0), <RateText key={c.id} r={rate(c.humanRepliesAllTime, c.peopleAllTime, 50)} />, count(c.leads)])} />}>
        <Table head={['Campaign', 'State', 'People', 'Sent', 'Bounce', 'Human']} numeric={[2, 3, 4, 5]}
          rows={d.campaigns.map((c) => [c.name.replace(/^\d+\s/, ''), <span key={c.id} className="chip">{chip(c.statusLabel)}</span>, count(c.peopleAllTime), count(c.sentAllTime), pct(c.sentAllTime ? (100 * c.bouncedAllTime) / c.sentAllTime : 0), count(c.humanRepliesAllTime)])} />
      </Tile>

      <Tile title="Mailboxes" span={4} foot={mail.notSending.length ? `Not sending: ${mail.notSending.join(', ')}` : undefined}>
        <KV rows={[
          { k: 'Connected and sending', v: `${count(mail.sending)} of ${count(mail.total)}` },
          { k: 'Warmup switched on', v: count(mail.warming), muted: !mail.warming },
          { k: 'Warmup score under 90', v: count(mail.lowScore.length), muted: !mail.lowScore.length },
          { k: 'Mailbox ceiling a day', v: count(d.mailboxCeiling) },
        ]} />
      </Tile>
      <Tile title="Retrospectives" span={8}
        big={<><Bars data={[...runRows].reverse()} x="label" series={[{ key: 'bouncePct', name: 'Bounce %' }]} fmt={(v) => pct(v)} tall reference={{ y: 3, label: '3% ceiling' }} />
          <Table head={['Run', 'Window', 'People', 'Sent', 'Bounce', 'Replies', 'Human', 'Positive', 'Calls']} numeric={[2, 3, 4, 5, 6, 7, 8]} rows={runRows.map((r) => [r.run, `${r.since} to ${r.until}`, count(r.people), count(r.sent), pct(r.bouncePct), count(r.replies), count(r.human), count(r.positive), count(r.calls)])} /></>}>
        {runRows.length ? <Table head={['Run', 'People', 'Sent', 'Bounce', 'Human', 'Positive', 'Calls']} numeric={[1, 2, 3, 4, 5, 6]} rows={runRows.map((r) => [shortDate(r.run), count(r.people), count(r.sent), pct(r.bouncePct), count(r.human), count(r.positive), count(r.calls)])} /> : <p className="empty">No retrospective saved yet. Add a row to the Cold email runs tab after each batch.</p>}
      </Tile>
    </main>
  );
}
