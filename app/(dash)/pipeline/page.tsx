'use client';

import { Tile, Problem, Empty } from '@/components/Tile';
import { KV, Table } from '@/components/Bits';
import { useDash } from '@/lib/store';
import { money, count, shortDate, plural } from '@/lib/format';
import { byStage, funnel, staleCards, upcomingBookings, waitingOnYou } from '@/lib/metrics';
import { STAGES, STAGE_TITLE as TITLE } from '@/lib/stages';
import { NotConnected } from '@/components/NotConnected';

export default function PipelinePage() {
  const { blob, loading, period, today, nowIso } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  if (!blob.cards.ok && blob.cards.off) return <NotConnected tool="a pipeline" how="Run npm run setup and pick ClickUp or the Pipeline tab in your sheet." />;
  if (!blob.cards.ok) return <main className="page"><Tile title="Pipeline" span={12}><Problem text={`The pipeline could not be read. ${blob.cards.error}`} /></Tile></main>;
  const zone = blob.config.timezone;
  const cards = blob.cards.data;
  const log = blob.stageLog.ok ? blob.stageLog.data : [];
  const stages = byStage(cards);
  const f = funnel(log, cards, period);
  const waiting = waitingOnYou(cards, today);
  const stale = staleCards(cards, log, today, 14);
  const upcoming = blob.bookings.ok ? upcomingBookings(blob.bookings.data, nowIso) : [];
  const value = (xs: { dealValue: number | null }[]) => xs.reduce((s, c) => s + (c.dealValue ?? 0), 0);

  return (
    <main className="page">
      <Tile title="Where every card sits now" span={12} foot={`Reached ${period.label.toLowerCase()}: ${plural(f.meetings, 'meeting')} booked, ${plural(f.proposals, 'proposal')} sent, ${count(f.won)} won, ${count(f.lost)} lost.`}
        bigTitle="Every card"
        big={<Table head={['Card', 'Stage', 'Company', 'Offer', 'Source', 'Deal value', 'Due', 'Created']} numeric={[5]}
          rows={cards.map((c) => [c.url ? <a key={c.id} href={c.url} target="_blank" rel="noreferrer">{c.name}</a> : c.name, c.rawStatus && c.rawStatus !== c.status ? `${c.status} (${c.rawStatus})` : c.status, c.company, c.offer, c.source, c.dealValue === null ? '' : money(c.dealValue), c.dueDate ? shortDate(c.dueDate) : '', shortDate(c.dateCreated)])} />}>
        <div className="stages">
          {STAGES.map((s) => (
            <div className="stage" key={s}>
              <div className="stage-head">
                <span className="spec">{TITLE[s]}</span>
                <span className="n">{count(stages[s].length)}</span>
              </div>
              <div className="sub-line" style={{ padding: '0 2px 8px' }}>{value(stages[s]) ? money(value(stages[s])) : ' '}</div>
              <div className="stage-list">
                {stages[s].length ? stages[s].map((c) => (
                  <a className="card" key={c.id} href={c.url || undefined} target="_blank" rel="noreferrer">
                    {c.name}
                    <div className="c2">{[c.offer, c.source, c.dueDate ? `due ${shortDate(c.dueDate)}` : ''].filter(Boolean).join(' · ')}</div>
                  </a>
                )) : <span className="empty">empty</span>}
              </div>
            </div>
          ))}
        </div>
      </Tile>

      <Tile title="Waiting on you" span={4}>
        {waiting.length ? waiting.map((c) => (
          <a className="card" key={c.id} href={c.url} target="_blank" rel="noreferrer">{c.name}<div className="c2">{c.status} · due {shortDate(c.dueDate ?? '')}</div></a>
        )) : <Empty text="Nothing due. Every open card has a follow up date in the future, or none set." />}
      </Tile>
      <Tile title="Next meetings" span={4} foot={blob.bookings.ok ? undefined : `Cal.com not read: ${blob.bookings.error}`}>
        {upcoming.length ? <KV rows={upcoming.slice(0, 6).map((b) => ({ k: `${shortDate(b.start)} ${new Date(b.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })}`, v: b.name || b.email }))} /> : <Empty text={blob.config.connected.calcom ? 'No meetings booked ahead. A booking lands here within five minutes.' : 'Cal.com is not connected. Run npm run setup to add it.'} />}
      </Tile>
      <Tile title="Gone quiet" span={4}>
        {stale.length ? <KV rows={stale.slice(0, 6).map((x) => ({ k: x.card.name, v: `${count(x.daysStill)} days` }))} /> : <Empty text="No open card has sat still for two weeks." />}
      </Tile>
    </main>
  );
}
