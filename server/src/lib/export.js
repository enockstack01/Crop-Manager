import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { resources, resourceByPath } from '../resources.js';
import { recordLoader } from './records.js';
import { buildQuery } from './queryBuilder.js';

/*
 * Exports of a farmer's records as CSV, Excel (.xlsx) and PDF. The same tables feed all three, so what is
 * on screen is in the file: every column that holds data, relations written as names, nothing cut off.
 * The PDF follows the Agricoders template (Pine header with the logo and CropManager once, Forest table
 * headers, Mist rows) and switches to landscape when the table is wide.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(HERE, '..', '..', 'assets', 'agricoders-logo-disc.png');
const C = { pine: '#14532D', forest: '#1B5E20', leaf: '#2E7D32', amber: '#F9A825', ink: '#1C2B1E', slate: '#5B6B5D', mist: '#F3F8F3', fern: '#D5E3D6', white: '#FFFFFF' };

const SINGULAR = { farms: 'Farm', fields: 'Field', crops: 'Crop', crop_varieties: 'Variety', seasons: 'Season', equipment: 'Equipment', inventory_items: 'Item' };
const SKIP = new Set(['id', 'user_id', 'updated_at', '__v', 'created_at']);
const title = (k) => { const s = String(k).replace(/_/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };

const cell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(cell).filter(Boolean).join(', ');
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return v.name ?? JSON.stringify(v);
  return v;
};

/** One record as ordered [label, value] pairs: relation names first, then its own fields. */
function flatten(row) {
  const pairs = new Map();
  const put = (label, v) => { const c = cell(v); if (c !== '' && !pairs.has(label)) pairs.set(label, c); };
  for (const [k, v] of Object.entries(row)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    if (k === 'crop_cycles') {
      put('Crop', v.crops?.name); put('Farm', v.farms?.name); put('Field', v.fields?.name); put('Season', v.seasons?.name);
    } else if (v.name !== undefined) put(SINGULAR[k] || title(k), v.name);
  }
  const own = Object.entries(row).filter(([k, v]) => !(SKIP.has(k) || k.endsWith('_id') || /photo|image|attachment/i.test(k)) && !(v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)));
  const keys = own.map(([k]) => k);
  const units = new Map(); // "area_unit" is written next to "area_planted": 45 hectares
  for (const [k, v] of own) {
    if (!k.endsWith('_unit') || cell(v) === '') continue;
    const base = k.slice(0, -5);
    const target = keys.find((x) => x === base) || keys.find((x) => x !== k && x.startsWith(`${base}_`) && !x.endsWith('_unit') && !x.endsWith('_date'));
    if (target) units.set(k, target); // a unit with no figure beside it is dropped below
  }
  const unitFor = new Map([...units].filter(([, t]) => cell(row[t]) !== '').map(([u, t]) => [t, cell(row[u])]));
  for (const [k, v] of own) {
    if (units.has(k)) continue;
    put(title(k), unitFor.has(k) ? `${cell(v)} ${unitFor.get(k)}` : v);
  }
  return pairs;
}

/** { headers, rows } for a list of records: only columns that hold data, in the order they first appear. */
export function tableFrom(records) {
  const flat = records.map(flatten);
  const headers = [];
  for (const m of flat) for (const k of m.keys()) if (!headers.includes(k)) headers.push(k);
  return { headers, rows: flat.map((m) => headers.map((h) => (m.has(h) ? m.get(h) : ''))) };
}

/** All of one resource for a user, narrowed by the same query string the list screen uses. */
export async function tableFor(resourcePath, userId, query = {}) {
  const resource = resourceByPath[resourcePath];
  if (!resource) return null;
  const { filter, sort } = buildQuery(query, resource, userId);
  delete filter.user_id;
  const records = await recordLoader(resourcePath, { filter, sort, limit: 20000 })(userId);
  return { name: resource.name, ...tableFrom(records) };
}

/* -------------------------------------------------------------------- csv */
export function toCsv(tables) {
  const esc = (v) => { const s = String(cell(v)); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const body = tables.map((t) => [
    ...(tables.length > 1 ? [t.title] : []),
    t.headers.map(esc).join(','),
    ...t.rows.map((r) => r.map(esc).join(',')),
  ].join('\r\n')).join('\r\n\r\n');
  return Buffer.from(`﻿${body}\r\n`, 'utf8'); // BOM so Excel reads accents correctly
}

/* ------------------------------------------------------------------- xlsx */
export async function toXlsx(tables, meta = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CropManager';
  wb.created = new Date();
  const used = new Set();
  for (const t of tables) {
    let name = String(t.title || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Sheet';
    for (let i = 2; used.has(name.toLowerCase()); i += 1) name = `${name.slice(0, 25)} ${i}`;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: meta.subtitle ? 3 : 2 }] });
    ws.addRow([t.title]).font = { bold: true, size: 14, color: { argb: 'FF1B5E20' } };
    if (meta.subtitle) ws.addRow([meta.subtitle]).font = { color: { argb: 'FF5B6B5D' }, size: 10 };
    const head = ws.addRow(t.headers);
    head.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    t.rows.forEach((r, i) => {
      const row = ws.addRow(r.map((v) => { const c = cell(v); return typeof c === 'string' && c !== '' && !Number.isNaN(Number(c)) && /^-?\d+(\.\d+)?$/.test(c) ? Number(c) : c; }));
      row.alignment = { vertical: 'top', wrapText: true };
      if (i % 2) row.eachCell({ includeEmpty: true }, (c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F8F3' } }; });
    });
    t.headers.forEach((h, i) => {
      const longest = t.rows.reduce((m, r) => Math.max(m, String(cell(r[i])).length), String(h).length);
      ws.getColumn(i + 1).width = Math.min(60, Math.max(10, longest + 2));
    });
    if (t.headers.length) ws.autoFilter = { from: { row: meta.subtitle ? 3 : 2, column: 1 }, to: { row: meta.subtitle ? 3 : 2, column: t.headers.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* -------------------------------------------------------------------- pdf */
export function toPdf(tables, meta = {}) {
  const wide = tables.some((t) => t.headers.length > 6);
  const doc = new PDFDocument({ size: 'A4', layout: wide ? 'landscape' : 'portrait', margin: 36, bufferPages: true });
  const chunks = [];
  doc.on('data', (d) => chunks.push(d));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const W = doc.page.width;
  const H = doc.page.height;
  const M = 36;
  const inner = W - 2 * M;
  const bottom = H - 44;

  // header band, page one only: Agricoders disc and the CropManager name once
  doc.rect(0, 0, W, 62).fill(C.pine);
  try { doc.image(LOGO, M, 11, { width: 40, height: 40 }); } catch { /* the logo file is optional */ }
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(19).text('CropManager', M + 52, 24, { lineBreak: false });
  doc.fontSize(8.5).text(String(meta.kind || 'Records').toUpperCase(), M, 22, { width: inner, align: 'right', characterSpacing: 1.5, lineBreak: false });
  doc.font('Helvetica').fontSize(9).text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), M, 38, { width: inner, align: 'right', lineBreak: false });
  doc.rect(0, 62, 110, 3).fill(C.amber);

  let y = 90;
  doc.fillColor(C.forest).font('Helvetica-Bold').fontSize(19).text(meta.title || 'Records', M, y, { width: inner });
  y = doc.y + 2;
  const sub = [meta.owner, meta.subtitle].filter(Boolean).join('  ·  ');
  if (sub) { doc.fillColor(C.slate).font('Helvetica').fontSize(9.5).text(sub, M, y + 4, { width: inner }); y = doc.y + 4; }
  doc.moveTo(M, y + 4).lineTo(W - M, y + 4).strokeColor(C.fern).stroke();
  y += 18;

  for (const t of tables) {
    if (!t.rows.length) continue;
    const n = t.headers.length;
    let size = n > 12 ? 6.5 : n > 9 ? 7.2 : n > 6 ? 8 : 8.8;
    const pad = n > 9 ? 3 : 4.5;
    // the longest word of every column must fit its column: shrink the type until the columns add up to the page
    const wordsOf = (i) => [String(t.headers[i]), ...t.rows.map((r) => String(cell(r[i])))].flatMap((x) => x.split(/\s+/));
    const needed = () => { doc.font('Helvetica-Bold').fontSize(size); return t.headers.reduce((a, h, i) => a + Math.max(...wordsOf(i).map((w) => doc.widthOfString(w))) + 2 * pad + 1, 0); };
    while (needed() > inner && size > 5) size -= 0.25;
    doc.font('Helvetica').fontSize(size);
    const want = t.headers.map((h, i) => {
      const longest = t.rows.reduce((m, r) => Math.max(m, String(cell(r[i])).length), String(h).length);
      return Math.min(46, Math.max(4, longest));
    });
    const minW = t.headers.map((h, i) => Math.max(...wordsOf(i).map((w) => doc.widthOfString(w))) + 2 * pad + 1);
    const total = want.reduce((a, b) => a + b, 0);
    // every column gets its longest word, the spare width is shared in proportion to content
    const spare = Math.max(0, inner - minW.reduce((a, b) => a + b, 0));
    const extra = want.map((w, i) => Math.max(0, w - minW[i] / 4));
    const extraSum = extra.reduce((a, b) => a + b, 0) || 1;
    const widths = minW.map((m, i) => m + (extra[i] / extraSum) * spare);

    if (y > bottom - 80) { doc.addPage(); y = M; }
    doc.fillColor(C.forest).font('Helvetica-Bold').fontSize(12.5).text(t.title, M, y);
    y = doc.y + 6;

    const drawRow = (cells, header, shade) => {
      doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
      const h = Math.max(...cells.map((c, i) => doc.heightOfString(String(cell(c)) || ' ', { width: widths[i] - 2 * pad }))) + 2 * pad;
      if (y + h > bottom) { doc.addPage(); y = M; if (!header) { drawRow(t.headers, true, false); } }
      let x = M;
      cells.forEach((c, i) => {
        if (header) doc.rect(x, y, widths[i], h).fill(C.forest);
        else {
          if (shade) doc.rect(x, y, widths[i], h).fill(C.mist);
          doc.rect(x, y, widths[i], h).lineWidth(0.4).strokeColor(C.fern).stroke();
        }
        doc.fillColor(header ? C.white : C.ink).font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(size)
          .text(String(cell(c)), x + pad, y + pad, { width: widths[i] - 2 * pad, lineBreak: true });
        x += widths[i];
      });
      y += h;
    };
    drawRow(t.headers, true, false);
    t.rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
    y += 18;
  }

  // footer: title and page numbers only
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // the footer sits inside the bottom margin; without this the text would add pages
    doc.moveTo(M, H - 30).lineTo(W - M, H - 30).strokeColor(C.fern).lineWidth(0.5).stroke();
    doc.fillColor(C.slate).font('Helvetica').fontSize(8)
      .text(String(meta.title || '').slice(0, 90), M, H - 24, { width: inner - 90, lineBreak: false })
      .text(`Page ${i + 1} / ${range.count}`, M, H - 24, { width: inner, align: 'right', lineBreak: false });
  }
  doc.end();
  return done;
}

/* ------------------------------------------------------------------ dispatch */
export const FORMATS = {
  csv: { type: 'text/csv; charset=utf-8', ext: 'csv' },
  xlsx: { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  pdf: { type: 'application/pdf', ext: 'pdf' },
};

export async function render(format, tables, meta) {
  if (format === 'csv') return toCsv(tables);
  if (format === 'xlsx') return toXlsx(tables, meta);
  return toPdf(tables, meta);
}

export const exportableResources = () => resources.filter((r) => !['calculation-history'].includes(r.path)).map((r) => ({ path: r.path, name: r.name }));
