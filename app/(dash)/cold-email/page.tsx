'use client';

import { Tile, Problem } from '@/components/Tile';
import { Hero, KV, RateText, Table } from '@/components/Bits';
import { Bars, C1, C3 } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { count, pct, shortDate, plural } from '@/lib/format';
import { emailAllTime, emailPeriod, mailboxHealth, rate } from '@/lib/metrics';
import { inPeriod } from '@/lib/period';
import { NotConnected } from '@/components/NotConnected';

export default function ColdEmailPage() {
  const { blob, loading, period } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.instantly.ok && blob.instantly.off) return <NotConnected tool="Instantly" how="Run npm run setup and paste your Instantly API key." />;
  if (!blob.instantly.ok) return <main className="page"><div className="full"><Problem text={`Instantly could not be read. ${blob.instantly.error}`} /></div></main>;

  const d = blob.instantly.data;
  const p = emailPeriod(d, period);
  const all = emailAllTime(d);
  const mail = mailboxHealth(d);
  const sentToday = d.campaigns.reduce((s, c) => s + c.sentToday, 0);
  const sending = d.campaigns.filter((c) => c.sendsToday).length;
  const halted = d.campaigns.filter((c) => c.status === -2).length;
  const humanRate = rate(p.humanReplies, p.people, 50);
  const daily = d.daily.slice(-30).map((x) => ({ ...x, label: shortDate(x.date) }));
  // Positive replies and meetings are judged by a person, so they come from the retrospective sheet, day by day.
  const days = blob.retro.ok ? blob.retro.data.days.filter((x) => inPeriod(x.date, period)) : null;
  const positive = days ? days.reduce((s, x) => s + (x.em_positive ?? 0), 0) : null;
  const meetings = days ? days.reduce((s, x) => s + (x.em_meetings ?? 0), 0) : null;
  const label = period.label.toLowerCase();

  return (
    <main className="page">
      <Tile title={`People emailed, ${label}`} span={3}>
        <Hero value={count(p.people)} />
        <div className="sub-line">{count(p.sent)} emails sent, follow ups included</div>
        <div className="sub-line">{count(sentToday)} sent today{d.ceiling ? ` of ${count(d.ceiling)} possible` : ''}</div>
      </Tile>
      <Tile title={`Replies from a person, ${label}`} span={3}>
        <Hero value={humanRate.pct === null ? count(p.humanReplies) : pct(humanRate.pct)} unit={`${humanRate.pct === null ? '' : `${count(p.humanReplies)} `}of ${count(p.people)} people`} />
        <div className="sub-line">Automatic replies, like out of office, are not counted.</div>
      </Tile>
      <Tile title={`Positive replies, ${label}`} span={3}>
        {positive === null ? <><Hero value="not read" small /><div className="sub-line">These come from the retrospective sheet, which is not connected.</div></> : (
          <><Hero value={count(positive)} /><div className="sub-line">{plural(meetings ?? 0, 'meeting')} booked from cold email</div></>
        )}
      </Tile>
      <Tile title="Bounce rate, all time" span={3}>
        <Hero value={pct(all.bounceRate.pct ?? 0)} unit={`${count(all.bounced)} of ${count(all.sent)}`} />
        <div className="sub-line">{halted ? `${count(halted)} of ${plural(d.campaigns.length, 'campaign')} stopped by bounces. ` : ''}Keep this under 3%.</div>
      </Tile>

      <Tile title="Emails sent and new people reached, each day, last 30 days" span={12}
        big={<Table head={['Day', 'Emails sent', 'New people', 'Replies from a person']} numeric={[1, 2, 3]} rows={[...d.daily].reverse().map((x) => [shortDate(x.date), count(x.sent), count(x.newPeople), count(x.replies)])} />}>
        <Bars data={daily} x="label" series={[{ key: 'sent', name: 'Emails sent', color: C1 }, { key: 'newPeople', name: 'New people reached', color: C3 }]} fmt={count} tall labels={false} />
      </Tile>

      <Tile title={`Campaigns, ${count(sending)} of ${count(d.campaigns.length)} sending today`} span={8}
        big={<Table head={['Campaign', 'State', 'Limit a day', 'People', 'Sent', 'Bounced', 'Bounce rate', 'Replies from a person', 'Leads loaded']} numeric={[2, 3, 4, 5, 6, 7, 8]}
          rows={d.campaigns.map((c) => [c.name, c.statusLabel, count(c.dailyLimit), count(c.peopleAllTime), count(c.sentAllTime), count(c.bouncedAllTime), pct(c.sentAllTime ? (100 * c.bouncedAllTime) / c.sentAllTime : 0), <RateText key={c.id} r={rate(c.humanRepliesAllTime, c.peopleAllTime, 50)} />, count(c.leads)])} />}>
        <Table head={['Campaign', 'State', 'People', 'Bounce rate', 'Replies']} numeric={[2, 3, 4]}
          rows={d.campaigns.map((c) => [c.name, c.statusLabel, count(c.peopleAllTime), pct(c.sentAllTime ? (100 * c.bouncedAllTime) / c.sentAllTime : 0), count(c.humanRepliesAllTime)])} />
      </Tile>
      <Tile title="Mailboxes" span={4} foot={mail.notSending.length ? `Not sending: ${mail.notSending.join(', ')}` : undefined}>
        <KV rows={[
          { k: 'Connected and sending', v: `${count(mail.sending)} of ${count(mail.total)}` },
          { k: 'Warm up score under 90', v: count(mail.lowScore.length), muted: !mail.lowScore.length },
          { k: 'Most emails they can send in a day', v: count(d.mailboxCeiling) },
        ]} />
      </Tile>
    </main>
  );
}
