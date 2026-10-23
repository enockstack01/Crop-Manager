import { asyncHandler } from '../lib/asyncHandler.js';
import createHttpError from '../lib/httpError.js';
import { resources } from '../resources.js';
import { FORMATS, render, tableFor } from '../lib/export.js';

const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
const plural = (r) => (r.path === 'equipment' ? 'Equipment' : `${r.name}s`);

function send(res, format, buf, base) {
  const f = FORMATS[format];
  res.setHeader('Content-Type', f.type);
  res.setHeader('Content-Disposition', `attachment; filename="${base}-${stamp()}.${f.ext}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(buf);
}
const formatOf = (req) => {
  const f = String(req.query.format || req.body?.format || 'csv').toLowerCase();
  if (!FORMATS[f]) throw createHttpError(400, 'Choose csv, xlsx or pdf.');
  return f;
};

/** GET /api/export/:path?format=csv|xlsx|pdf  (plus the list filters ?q= etc.)  Every record of one kind. */
export const exportResource = asyncHandler(async (req, res) => {
  const resource = resources.find((r) => r.path === req.params.path);
  if (!resource) throw createHttpError(404, 'Unknown records.');
  const format = formatOf(req);
  const table = await tableFor(resource.path, req.userId, req.query);
  const q = String(req.query.q || '').trim();
  const t = { title: plural(resource), headers: table.headers, rows: table.rows };
  const buf = await render(format, [t], { kind: 'Records', title: plural(resource), owner: req.profile?.full_name || '', subtitle: `${table.rows.length} ${table.rows.length === 1 ? 'record' : 'records'}${q ? ` · "${q}"` : ''}` });
  send(res, format, buf, safe(resource.path));
});

/** GET /api/export?format=xlsx|pdf  Everything the farmer has recorded, one sheet (or section) per kind. */
export const exportAll = asyncHandler(async (req, res) => {
  const format = formatOf(req);
  const tables = [];
  for (const r of resources) {
    if (['calculation-history', 'notifications'].includes(r.path)) continue;
    const t = await tableFor(r.path, req.userId, {});
    if (t?.rows.length) tables.push({ title: plural(r), headers: t.headers, rows: t.rows });
  }
  if (!tables.length) throw createHttpError(404, 'There are no records to export yet.');
  const buf = await render(format, tables, { kind: 'All records', title: 'All records', owner: req.profile?.full_name || '', subtitle: `${tables.length} kinds of records` });
  send(res, format, buf, 'cropmanager-all-records');
});

/** POST /api/export/tables {format, title, subtitle, tables:[{title, headers, rows}]}  Spreadsheet of a report built on the device. */
export const exportTables = asyncHandler(async (req, res) => {
  const format = formatOf(req);
  const b = req.body || {};
  const tables = (Array.isArray(b.tables) ? b.tables : []).slice(0, 12).map((t) => ({
    title: String(t.title || 'Table').slice(0, 80),
    headers: (Array.isArray(t.headers) ? t.headers : []).slice(0, 40).map((h) => String(h).slice(0, 80)),
    rows: (Array.isArray(t.rows) ? t.rows : []).slice(0, 20000).map((r) => (Array.isArray(r) ? r.slice(0, 40).map((c) => (c === null || c === undefined ? '' : typeof c === 'object' ? JSON.stringify(c) : c)) : [])),
  })).filter((t) => t.headers.length && t.rows.length);
  if (!tables.length) throw createHttpError(400, 'There is nothing to export.');
  const buf = await render(format, tables, { kind: String(b.kind || 'Report').slice(0, 40), title: String(b.title || 'Report').slice(0, 120), owner: req.profile?.full_name || '', subtitle: String(b.subtitle || '').slice(0, 200) });
  send(res, format, buf, safe(b.title || 'report'));
});
