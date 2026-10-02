// Ported from client/src/lib/format.js

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

export function formatNumber(num?: number | string | null): string {
  if (num === null || num === undefined || num === '') return '0';
  return Number(num).toLocaleString('en-US');
}

// The signed-in user's default currency (Settings → Default currency, default USD).
// RootGate sets it from the profile; it pre-fills the currency on new records and is
// the fallback when a value has no currency of its own. Records carry their own
// `currency`, so pass it: formatCurrency(r.amount, r.currency).
let userCurrency = 'USD';
export function setCurrency(code?: string | null) {
  userCurrency = code || 'USD';
}
export function getCurrency(): string {
  return userCurrency;
}

/** What the app calls the user: their name, or their account type until they give one. */
export function displayName(profile?: { full_name?: string | null; role?: string | null } | null): string {
  return profile?.full_name?.trim() || profile?.role || 'Farmer';
}

export function formatCurrency(amount?: number | string | null, currency?: string | null): string {
  currency = currency || userCurrency;
  if (amount === null || amount === undefined || amount === '') return `${currency} 0.00`;
  return (
    currency +
    ' ' +
    Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

type Money = { currency?: string | null };

/** Totals per currency — money in different currencies is never added together. */
export function sumByCurrency<T extends Money>(rows: T[] | undefined, value: (r: T) => any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows || []) {
    const c = r.currency || userCurrency;
    out[c] = (out[c] || 0) + (Number(value(r)) || 0);
  }
  return out;
}

/** "USD 1,200.00 · RWF 450,000.00" (largest first); "USD 0.00" when empty. */
export function formatTotals(totals: Record<string, number>, sep = ' · '): string {
  const entries = Object.entries(totals || {}).filter(([, v]) => v !== 0);
  if (!entries.length) return formatCurrency(0);
  return entries.sort((a, b) => b[1] - a[1]).map(([c, v]) => formatCurrency(v, c)).join(sep);
}

/** Currencies used by these rows, most-used first (by number of records). */
export function currenciesUsed(...rowSets: (Money[] | undefined)[]): string[] {
  const n: Record<string, number> = {};
  for (const rows of rowSets) for (const r of rows || []) { const c = r.currency || userCurrency; n[c] = (n[c] || 0) + 1; }
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** ISO yyyy-mm-dd for a Date (used by the date picker fields). */
export function toISODate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function parseISODate(s?: string | null): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
