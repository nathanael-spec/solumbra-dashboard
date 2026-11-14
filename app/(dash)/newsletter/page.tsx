'use client';

import { Tile, Problem, Empty } from '@/components/Tile';
import { Change, Hero, Notice, Table } from '@/components/Bits';
import { Lines, C1 } from '@/components/Charts';
import { useDash } from '@/lib/store';
import { count, pct, plural, shortDate } from '@/lib/format';
import { newsletterNow, newsletterPeriod, newsletterRate, newsletterWeeks, type Rate } from '@/lib/metrics';
import { NotConnected } from '@/components/NotConnected';

const STEPS = 10;

/** Ten marks toward the number the weekly email starts at. Counted, not a bar, so it never reads as a deadline. */
function Marks({ have, goal }: { have: number; goal: number }) {
  const done = Math.min(STEPS, Math.floor((STEPS * have) / goal));
  return (
    <div className="marks" role="img" aria-label={`${count(Math.min(have, goal))} of ${count(goal)} subscribers`}>
      {Array.from({ length: STEPS }, (_, i) => <i key={i} className={i < done ? 'done' : i === done ? 'now' : ''} />)}
    </div>
  );
}

/** A rate over every email sent: a fraction under 10 emails, a percentage from 10 on. */
function RateTile({ title, r, sent, did, ignored }: { title: string; r: Rate; sent: number; did: string; ignored: number }) {
  return (
    <Tile title={title} span={3}>
      {r.whole === 0 ? <Hero value="none yet" small /> : r.pct === null ? <Hero value={`${count(r.part)} of ${count(r.whole)}`} unit={`emails ${did}`} /> : <Hero value={pct(r.pct)} />}
      <div className="sub-line">
        {r.whole === 0 ? 'No email has gone out yet.' : r.pct === null ? 'Too few emails to read as a percentage.' : `Beehiiv's average over ${plural(sent, 'email')} sent.`}
      </div>
      {ignored && r.whole > 0 ? <div className="sub-line">Your test addresses are still inside this number.</div> : null}
    </Tile>
  );
}

export default function NewsletterPage() {
  const { blob, loading, period, today } = useDash();
  if (!blob) return <div className="loading">{loading ? 'Reading the tools.' : 'Nothing loaded yet.'}</div>;
  const src = blob.newsletter;
  if (!src.ok && src.off) return <NotConnected tool="Beehiiv" how="Add BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID to .env.local and to the Vercel project. Or run npm run setup, which asks for both." />;
  if (!src.ok) return <main className="page"><div className="full"><Problem text={`Beehiiv could not be read. ${src.error}`} /></div></main>;

  const d = src.data;
  const goal = blob.config.newsletterStartAt;
  const now = newsletterNow(d);
  const p = newsletterPeriod(d, period);
  const weeks = newsletterWeeks(d, today).map((w) => ({ ...w, label: shortDate(w.week) }));
  const open = d.stats ? newsletterRate(d.stats.openRate, d.stats.opened, d.stats.sent) : null;
  const click = d.stats ? newsletterRate(d.stats.clickRate, d.stats.clicked, d.stats.sent) : null;
  const rates = (open ? 1 : 0) + (click ? 1 : 0);
  const label = period.label.toLowerCase();

  return (
    <main className="page">
      {d.capped ? <div className="full"><Notice>The list is longer than one refresh can read. The newest sign ups are missing from this page.</Notice></div> : null}

      <Tile title="Active subscribers" span={4}>
        <Hero value={count(now.active)} unit={now.active >= goal ? undefined : `of ${count(goal)}`} />
        <Marks have={now.active} goal={goal} />
        <div className="sub-line">Weekly email starts at {count(goal)}.{now.active >= goal ? ' That number is reached.' : ''}</div>
      </Tile>
      <Tile title={`New subscribers, ${label}`} span={4}>
        <Hero value={count(p.signUps)} />
        <Change now={p.signUps} before={p.signUpsBefore} versus="the period before" />
        {p.leftSince ? <div className="sub-line">{count(p.leftSince)} of them {p.leftSince === 1 ? 'has' : 'have'} left since.</div> : null}
      </Tile>
      <Tile title="Unsubscribes, all time" span={4}>
        <Hero value={count(now.left)} />
        <div className="sub-line">Beehiiv does not give the day a person left. So this number covers all time and does not follow the period.</div>
      </Tile>

      <Tile title="Subscribers, added up week by week" span={12}
        foot="Each point is everyone who had signed up by that week and is still subscribed today."
        big={<Table head={['Week of', 'New', 'Total so far']} numeric={[1, 2]} rows={[...weeks].reverse().map((w) => [w.label, count(w.added), count(w.total)])} />}>
        <Lines data={weeks} x="label" series={[{ key: 'total', name: 'Subscribers', color: C1 }]} fmt={count} area tall whole />
      </Tile>

      <Tile title={`Sign ups by source, ${label}`} span={12 - 3 * rates}
        foot="The source is the tag on the link a person came through. A sign up with no tag shows as direct.">
        {p.sources.length
          ? <Table head={['Source', 'Sign ups']} numeric={[1]} rows={p.sources.map((s) => [s.name, count(s.count)])} />
          : <Empty text="No sign ups in this period." />}
      </Tile>
      {open && d.stats ? <RateTile title="Open rate, every email so far" r={open} sent={d.stats.sent} did="opened" ignored={d.ignored} /> : null}
      {click && d.stats ? <RateTile title="Click rate, every email so far" r={click} sent={d.stats.sent} did="clicked" ignored={d.ignored} /> : null}
    </main>
  );
}
