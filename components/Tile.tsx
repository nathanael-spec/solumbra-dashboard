'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A pane with a spec label. When `big` is given the tile can open into a full
 * size view, which is where the large chart and the rows behind it live.
 */
export function Tile({ title, span = 3, short = false, foot, children, big, bigTitle }: {
  title: string; span?: number; short?: boolean; foot?: ReactNode; children: ReactNode; big?: ReactNode; bigTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <section className={`tile${short ? ' short' : ''}`} style={{ gridColumn: `span ${span}` }} data-wide={span >= 6 ? '' : undefined}>
      <div className="tile-head">
        <span className="spec">{title}</span>
        {big ? <button className="tile-open" onClick={() => setOpen(true)} aria-label={`Open ${title} full size`}>See details</button> : null}
      </div>
      <div className="tile-body">{children}</div>
      {foot ? <div className="tile-foot">{foot}</div> : null}
      {big ? (
        <dialog ref={ref} className="sheet" aria-label={bigTitle ?? title} onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) setOpen(false); }}>
          <div className="inner">
            <div className="sheet-head">
              <h2>{bigTitle ?? title}</h2>
              <button className="quiet-btn" onClick={() => setOpen(false)}>Close</button>
            </div>
            {open ? big : null}
          </div>
        </dialog>
      ) : null}
    </section>
  );
}

export function Problem({ text }: { text: string }) {
  return <div className="problem">{text}</div>;
}

export function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}
