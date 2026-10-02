// Ported verbatim from the original js/utils.js formatting helpers.

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

export function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '0';
  return Number(num).toLocaleString('en-US');
}

// The signed-in user's default currency (Settings → Default currency, default USD).
// AppLayout sets it from the profile; it pre-fills the currency on new records and is
// the fallback when a value has no currency of its own. Records carry their own
// `currency`, so pass it: formatCurrency(r.amount, r.currency).
let userCurrency = 'USD';
export function setCurrency(code) {
  userCurrency = code || 'USD';
}
export function getCurrency() {
  return userCurrency;
}

/** What the app calls the user: their name, or their account type until they give one. */
export function displayName(profile) {
  return profile?.full_name?.trim() || profile?.role || 'Farmer';
}

export function formatCurrency(amount, currency) {
  currency = currency || userCurrency;
  if (amount === null || amount === undefined || amount === '') return `${currency} 0.00`;
  return (
    currency +
    ' ' +
    Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/**
 * Totals per currency — money in different currencies is never added together.
 * `sumByCurrency(rows, (r) => r.amount)` → { USD: 1200, RWF: 450000 }
 */
export function sumByCurrency(rows, value) {
  const out = {};
  for (const r of rows || []) {
    const v = Number(value(r)) || 0;
    const c = r.currency || userCurrency;
    out[c] = (out[c] || 0) + v;
  }
  return out;
}

/** "USD 1,200.00 · RWF 450,000.00" (largest first); "USD 0.00" when empty. */
export function formatTotals(totals, sep = ' · ') {
  const entries = Object.entries(totals || {}).filter(([, v]) => v !== 0);
  if (!entries.length) return formatCurrency(0);
  return entries.sort((a, b) => b[1] - a[1]).map(([c, v]) => formatCurrency(v, c)).join(sep);
}

/** Currencies used by these rows, most-used first (by number of records). */
export function currenciesUsed(...rowSets) {
  const n = {};
  for (const rows of rowSets) for (const r of rows || []) { const c = r.currency || userCurrency; n[c] = (n[c] || 0) + 1; }
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const BADGE_MAP = {
  Active: 'badge-success', Fallow: 'badge-neutral', Preparing: 'badge-warning', Maintenance: 'badge-info',
  Planned: 'badge-info', Planted: 'badge-primary', Growing: 'badge-success', 'Ready for Harvest': 'badge-warning',
  Harvested: 'badge-primary', Completed: 'badge-success', Cancelled: 'badge-danger',
  Available: 'badge-success', 'In Use': 'badge-info', Damaged: 'badge-danger', Retired: 'badge-neutral',
  Pending: 'badge-warning', 'Partially Paid': 'badge-info', Paid: 'badge-success',
  Low: 'badge-warning', Moderate: 'badge-info', High: 'badge-danger', Critical: 'badge-danger',
  Healthy: 'badge-success', 'Under Observation': 'badge-warning', 'At Risk': 'badge-danger',
  'In Stock': 'badge-success', 'Low Stock': 'badge-warning', 'Out of Stock': 'badge-danger',
};

export function badgeClass(status) {
  return BADGE_MAP[status] || 'badge-neutral';
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
