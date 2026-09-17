'use client';

/**
 * The manual way in, for the things no tool records: a meeting booked by
 * text message, a proposal sent by hand, a deal agreed on a call, money that
 * arrived by Zelle. Meetings, proposals and deals go to the Stage log tab of
 * the dashboard sheet. Cash goes to the P&L Ledger, the only books.
 */
import { useEffect, useRef, useState } from 'react';
import { useDash, todayIn } from '@/lib/store';

type Kind = 'meeting' | 'proposal' | 'deal' | 'cash';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'meeting', label: 'Meeting booked' },
  { key: 'proposal', label: 'Proposal sent' },
  { key: 'deal', label: 'Deal closed' },
  { key: 'cash', label: 'Cash collected' },
];
const HOW_PAID = ['Bank transfer', 'Stripe card', 'Upwork', 'PayPal', 'Cash', 'Other'];

export function ManualEntry({ onClose }: { onClose: () => void }) {
  const { refresh, config, today } = useDash();
  const CHANNELS = config?.channels.length ? config.channels : ['Network'];
  const SOURCES = [...CHANNELS, 'Referral', 'Other'].filter((v, i, a) => a.indexOf(v) === i);
  const CATEGORIES = config?.categories.length ? config.categories : ['Other'];
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<Kind>('meeting');
  const [date, setDate] = useState(today);
  const [who, setWho] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState(SOURCES[0]);
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [howPaid, setHowPaid] = useState(HOW_PAID[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const needsAmount = kind === 'deal' || kind === 'cash';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, date, who, amount: amount ? Number(amount) : null, source, channel, category, howPaid, note }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; wrote?: string };
    setBusy(false);
    if (!res.ok || !body.ok) {
      setError(body.error ?? `The page could not save that (${res.status}).`);
      return;
    }
    setDone(body.wrote ?? 'Saved.');
    void refresh();
  }

  return (
    <dialog ref={ref} className="sheet narrow" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="inner">
        <div className="sheet-head">
          <h2>Add by hand</h2>
          <button className="quiet-btn" onClick={onClose}>Close</button>
        </div>
        {done ? (
          <>
            <p className="sub-line">{done}</p>
            <div className="row-gap">
              <button className="quiet-btn" onClick={() => { setDone(null); setWho(''); setAmount(''); setNote(''); }}>Add another</button>
              <button className="quiet-btn" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="manual">
            <div className="segment" role="group" aria-label="What happened">
              {KINDS.map((k) => (
                <button type="button" key={k.key} className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)} aria-pressed={kind === k.key}>{k.label}</button>
              ))}
            </div>
            <label className="f"><span>Date</span><input type="date" value={date} max={todayIn(config?.timezone)} onChange={(e) => setDate(e.target.value)} required /></label>
            <label className="f"><span>{kind === 'cash' ? 'Who paid' : 'Who, and the company'}</span><input value={who} onChange={(e) => setWho(e.target.value)} placeholder={kind === 'cash' ? 'Maria Lopez' : 'Maria Lopez, Harbor Reception'} required /></label>
            {needsAmount ? <label className="f"><span>{kind === 'deal' ? 'Deal value, dollars' : 'Amount, dollars'}</span><input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label> : null}
            {kind === 'cash' ? (
              <>
                <label className="f"><span>Channel, how they found you</span><select value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="f"><span>What it was for</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="f"><span>How it was paid</span><select value={howPaid} onChange={(e) => setHowPaid(e.target.value)}>{HOW_PAID.map((c) => <option key={c}>{c}</option>)}</select></label>
              </>
            ) : (
              <label className="f"><span>Where they came from</span><select value={source} onChange={(e) => setSource(e.target.value)}>{SOURCES.map((c) => <option key={c}>{c}</option>)}</select></label>
            )}
            <label className="f"><span>Note, optional</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Booked over WhatsApp" /></label>
            {error ? <p className="problem">{error}</p> : null}
            <p className="tile-foot">{config?.demo ? 'Demo mode: nothing is saved.' : kind === 'cash' ? 'This writes a row into the Ledger tab, marked Received. Fees go in by hand as usual.' : 'This writes a row into the Stage log tab. It does not touch your CRM.'}</p>
            <div className="row-gap">
              <button className="pill" type="submit" disabled={busy || !who || (needsAmount && !amount)}>{busy ? 'Saving' : 'Save'}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
