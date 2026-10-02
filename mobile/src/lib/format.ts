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

// The signed-in user's currency (Settings → Currency, default USD). RootGate sets it
// from the profile before the app renders, so every formatCurrency() call uses it.
let userCurrency = 'USD';
export function setCurrency(code?: string | null) {
  userCurrency = code || 'USD';
}

/** What the app calls the user: their name, or their account type until they give one. */
export function displayName(profile?: { full_name?: string | null; role?: string | null } | null): string {
  return profile?.full_name?.trim() || profile?.role || 'Farmer';
}

export function formatCurrency(amount?: number | string | null, currency = userCurrency): string {
  if (amount === null || amount === undefined || amount === '') return `${currency} 0.00`;
  return (
    currency +
    ' ' +
    Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
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
