import { resources, resourceByPath } from '../../resources.js';
import { recordLoader } from '../records.js';

/*
 * Tools the chat assistant can call to look at the farmer's own records (read only, always scoped to the
 * signed-in user). The farm snapshot in the system prompt gives the overview; these tools fetch the detail.
 * Other modules (weather, calculators) add their own tools with `extra`.
 */
const OPEN = new Set(['notifications', 'calculation-history']);
const PATHS = resources.map((r) => r.path).filter((p) => !OPEN.has(p));
const DROP = new Set(['id', 'user_id', 'created_at', 'updated_at']);

/** Keeps the readable fields of a record: drops internal ids and empty values. */
function trim(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (DROP.has(k) || k.endsWith('_id') || v === null || v === '' || v === undefined) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? (v.name ?? v) : v;
  }
  return out;
}

export function farmTools(userId, extra = { tools: [], handlers: {} }) {
  const tools = [
    {
      name: 'query_records',
      description: 'Look up the farmer\'s own records. Use it whenever an answer depends on details that are not in the farm snapshot: dates, quantities, amounts, notes, history of a field or crop. Returns the newest records first.',
      input_schema: {
        type: 'object',
        properties: {
          resource: { type: 'string', enum: PATHS, description: 'Which kind of record: crop-cycles, harvest-records, expenses, sales, irrigation-records, fertilizer-applications, crop-scouting-records, inventory-items...' },
          search: { type: 'string', description: 'Optional words to match in names, notes or descriptions' },
          from: { type: 'string', description: 'Optional YYYY-MM-DD: only records on or after this date' },
          to: { type: 'string', description: 'Optional YYYY-MM-DD: only records on or before this date' },
          limit: { type: 'integer', description: 'How many records to return (1 to 40, default 15)' },
        },
        required: ['resource'],
      },
    },
    ...extra.tools,
  ];

  const handlers = {
    async query_records({ resource, search, from, to, limit = 15 }) {
      const r = resourceByPath[resource];
      if (!r || !PATHS.includes(resource)) return { error: 'Unknown record type' };
      const n = Math.min(40, Math.max(1, Number(limit) || 15));
      const sortField = r.defaultSort || 'created_at';
      let rows = await recordLoader(resource, { sort: { [sortField]: -1 }, limit: 400 })(userId);
      const dateKey = rows[0] && Object.keys(rows[0]).find((k) => /date$/.test(k));
      if (dateKey && from) rows = rows.filter((x) => (x[dateKey] || '') >= from);
      if (dateKey && to) rows = rows.filter((x) => (x[dateKey] || '') <= to);
      if (search) {
        const q = String(search).toLowerCase();
        rows = rows.filter((x) => JSON.stringify(x).toLowerCase().includes(q));
      }
      return { resource, total_matching: rows.length, shown: Math.min(n, rows.length), records: rows.slice(0, n).map(trim) };
    },
    ...extra.handlers,
  };
  return { tools, handlers };
}
