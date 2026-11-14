const int = new Intl.NumberFormat('en-US');
let whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
let exact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The currency comes from the config (CURRENCY in .env.local). Called once when the data arrives. */
export function setCurrency(code: string): void {
  try {
    whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 0 });
    exact = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch { /* an unknown code keeps the previous one */ }
}

/** Losses read as -$26, never $-26. */
export function money(n: number | null | undefined, cents = false): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  const f = cents ? exact : whole;
  return n < 0 ? '-' + f.format(-n) : f.format(n);
}

export function count(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : int.format(n);
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return `${n.toFixed(digits)}%`;
}

export function shortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function weekLabel(monday: string): string {
  return shortDate(monday);
}

export function ago(iso: string, nowMs = Date.now()): string {
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'} ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** Money for a chart axis, where there is no room for every digit: $850, $1.2k, $14k. */
export function moneyShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a < 1000) return money(Math.round(n));
  const k = a / 1000;
  const symbol = whole.format(0).replace(/[\d.,\s]/g, '');
  return `${sign}${symbol}${k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`;
}
