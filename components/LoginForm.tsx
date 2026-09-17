'use client';

import { useState } from 'react';

export function LoginForm({ name, logoUrl }: { name: string; logoUrl: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) {
      window.location.href = '/';
      return;
    }
    setError('That is not it. Try again.');
    setBusy(false);
  }

  return (
    <main className="login-shell">
      <header className="masthead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl ? <img className="mark" src={logoUrl} alt={name} /> : null}
        <span className="spec">{name.toUpperCase()} / DASHBOARD</span>
      </header>
      <h1 className="headline">The numbers.</h1>
      <p className="deck">One password. Only you have it.</p>
      <section className="pane">
        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error ? <p className="caption" style={{ marginBottom: 14 }}>{error}</p> : null}
          <button className="pill" type="submit" disabled={busy || !password}>{busy ? 'Checking' : 'Enter'}</button>
        </form>
      </section>
    </main>
  );
}
