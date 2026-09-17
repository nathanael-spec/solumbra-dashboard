'use client';

import { Tile } from './Tile';

/** A page for a tool that was never connected. Quiet, with the one thing to do. */
export function NotConnected({ tool, how }: { tool: string; how: string }) {
  return (
    <main className="page">
      <Tile title={`${tool} is not connected`} span={12}>
        <p className="empty" style={{ padding: 8 }}>{how}</p>
      </Tile>
    </main>
  );
}

/** Nothing configured at all: the first thing a fresh install sees. */
export function SetupNeeded() {
  return (
    <main className="page">
      <Tile title="Nothing is connected yet" span={12}>
        <div style={{ padding: 8, display: 'grid', gap: 10 }}>
          <p className="empty">This dashboard reads your money from a Google Sheet and your pipeline from ClickUp or a tab in that sheet. Neither is connected.</p>
          <p className="empty">In the terminal, in this folder, run <code>npm run setup</code>. It asks where your P&L and CRM are, checks each key, and writes <code>.env.local</code>.</p>
          <p className="empty">To look around first with made up numbers, stop the server and run <code>npm run demo</code>.</p>
        </div>
      </Tile>
    </main>
  );
}
