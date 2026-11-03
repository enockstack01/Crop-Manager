/*
 * Recording periods for exports. "All time" (nothing chosen) is the default; the other choices become a
 * from/to pair of calendar dates in the person's own time zone, which the server turns into a filter.
 */
export type PeriodId = 'all' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'last_year' | 'custom';
export type Period = { from?: string; to?: string };

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'this_year', label: 'This year' },
  { id: 'last_year', label: 'Last year' },
  { id: 'custom', label: 'Custom range' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** { from, to } for a period id ({} means everything). `custom` is what the person picked. */
export function periodRange(id: PeriodId, custom: Period = {}, now = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (id) {
    case 'this_month': return { from: key(new Date(y, m, 1)), to: key(new Date(y, m + 1, 0)) };
    case 'last_month': return { from: key(new Date(y, m - 1, 1)), to: key(new Date(y, m, 0)) };
    case 'last_3_months': return { from: key(new Date(y, m - 3, now.getDate())), to: key(now) };
    case 'this_year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'custom': return { ...(custom.from ? { from: custom.from } : {}), ...(custom.to ? { to: custom.to } : {}) };
    default: return {};
  }
}
