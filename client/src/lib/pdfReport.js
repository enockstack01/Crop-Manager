import { t } from '../i18n/index.js';

/*
 * Branded PDFs (Agricoders Brand and Template Guidelines v1.0): one Pine header band with the Agricoders
 * disc and the CropManager name shown once, Forest titles and table headers, Mist alternate rows, Leaf
 * Green figures, Amber as the single highlight. The footer carries only the report title and page
 * numbers, so the brand is not repeated. Wide tables switch the page to landscape, every column gets
 * room in proportion to its content and long text wraps, so nothing is cut off.
 * Built in the browser with jsPDF (loaded on demand); Helvetica stands in for Calibri.
 */
const C = {
  pine: [20, 83, 45], forest: [27, 94, 32], leaf: [46, 125, 50], amber: [249, 168, 37], alert: [198, 40, 40],
  ink: [28, 43, 30], slate: [91, 107, 93], mist: [243, 248, 243], fern: [213, 227, 214], white: [255, 255, 255],
};
const HEAD_H = 62;
const TOP = 92; // first content line on page one

async function loadImage(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

const today = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const clean = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));

/** Header band, page one only: Agricoders disc + CropManager once, report type and date on the right. */
function drawHeader(doc, disc, W, M, kind) {
  doc.setFillColor(...C.pine);
  doc.rect(0, 0, W, HEAD_H, 'F');
  doc.addImage(disc, 'PNG', M, 11, 40, 40);
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text('CropManager', M + 52, 38);
  doc.setFontSize(8.5);
  doc.setCharSpace(1.5);
  doc.text(String(kind || '').toUpperCase(), W - M, 28, { align: 'right' });
  doc.setCharSpace(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(today(), W - M, 44, { align: 'right' });
  doc.setFillColor(...C.amber);
  doc.rect(0, HEAD_H, 110, 3, 'F');
}

/** Footer on every page: report title left, page numbers right. */
function drawFooters(doc, W, H, M, title) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...C.fern);
    doc.line(M, H - 30, W - M, H - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.slate);
    doc.text(doc.splitTextToSize(String(title || ''), W - 2 * M - 90)[0] || '', M, H - 17);
    doc.text(`${t('Page')} ${i} / ${pages}`, W - M, H - 17, { align: 'right' });
  }
}

const loadDisc = () => loadImage('/brand/agricoders-logo-disc.png');

/** Charts on the page as images (on a white or dark backing so their text stays readable). */
function chartImages(root, dark) {
  const out = [];
  root.querySelectorAll('canvas').forEach((cv) => {
    if (!cv.width || !cv.height) return;
    const tmp = document.createElement('canvas');
    tmp.width = cv.width;
    tmp.height = cv.height;
    const ctx = tmp.getContext('2d');
    ctx.fillStyle = dark ? '#1E1E1E' : '#FFFFFF';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(cv, 0, 0);
    out.push({ data: tmp.toDataURL('image/png'), ratio: cv.height / cv.width });
  });
  return out;
}

/** Column widths in proportion to content so every column fits the page and long text wraps. */
function fitColumns(headers, rows, width) {
  const weights = headers.map((h, c) => {
    const longest = rows.reduce((m, r) => Math.max(m, String(clean(r[c])).length), String(h).length);
    const longestWord = rows.reduce((m, r) => Math.max(m, ...String(clean(r[c])).split(/\s+/).map((w) => w.length)), ...String(h).split(/\s+/).map((w) => w.length));
    return { min: Math.min(60, Math.max(4, longestWord)), want: Math.min(48, Math.max(4, longest)) };
  });
  const total = weights.reduce((a, w) => a + w.want, 0);
  const styles = {};
  weights.forEach((w, i) => { styles[i] = { cellWidth: Math.max(30, (w.want / total) * width) }; });
  // normalise so the widths add up to the page width exactly
  const sum = Object.values(styles).reduce((a, s) => a + s.cellWidth, 0);
  Object.values(styles).forEach((s) => { s.cellWidth = (s.cellWidth / sum) * width; });
  return styles;
}

/** Wide tables go on a landscape page. */
const wantsLandscape = (sections) => sections.some((s) => s.type === 'table' && (s.headers.length > 6 || s.headers.length * 2 + s.rows.reduce((m, r) => Math.max(m, r.reduce((a, c) => a + String(c ?? '').length, 0)), 0) / 12 > 40));

/**
 * Builds and saves a report from sections:
 *  { type: 'tiles', tiles: [{label, value, sub}] }
 *  { type: 'charts', title, root, dark }
 *  { type: 'table', title, headers, rows }
 *  { type: 'text', title, text }
 *  { type: 'list', title, items: [string | {head, body}], numbered }
 *  { type: 'pairs', title, rows: [[label, value]] }
 *  { type: 'note', text }
 * @param {object} o { kind, title, meta[], sections[], fileName, landscape }
 */
export async function downloadDocPdf(o) {
  const [{ jsPDF }, { default: autoTable }, disc] = await Promise.all([import('jspdf'), import('jspdf-autotable'), loadDisc()]);
  const landscape = o.landscape ?? wantsLandscape(o.sections);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const inner = W - 2 * M;
  drawHeader(doc, disc, W, M, o.kind);

  let y = TOP;
  const room = (h) => { if (y + h > H - 44) { doc.addPage(); y = M; } };

  // title + meta
  doc.setTextColor(...C.forest);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(o.title, inner);
  doc.text(titleLines, M, y + 12);
  y += titleLines.length * 23 + 2;
  const meta = (o.meta || []).filter(Boolean).join('  ·  ');
  if (meta) {
    doc.setTextColor(...C.slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const ml = doc.splitTextToSize(meta, inner);
    doc.text(ml, M, y + 8);
    y += ml.length * 12 + 6;
  }
  doc.setDrawColor(...C.fern);
  doc.line(M, y + 4, W - M, y + 4);
  y += 18;

  const heading = (label) => {
    room(50);
    doc.setTextColor(...C.forest);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text(label, M, y);
    y += 10;
  };
  const paragraph = (text, x = M, w = inner, size = 10) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...C.ink);
    for (const line of doc.splitTextToSize(String(text), w)) {
      room(15);
      doc.text(line, x, y + 4);
      y += size + 4.5;
    }
  };

  for (const s of o.sections) {
    if (s.type === 'tiles' && s.tiles?.length) {
      const perRow = Math.min(landscape ? 6 : 4, s.tiles.length);
      const gap = 8;
      const cw = (inner - gap * (perRow - 1)) / perRow;
      const rowsN = Math.ceil(s.tiles.length / perRow);
      room(rowsN * 62 + 6);
      s.tiles.forEach((tile, i) => {
        const x = M + (i % perRow) * (cw + gap);
        const ty = y + Math.floor(i / perRow) * 62;
        doc.setDrawColor(...C.fern);
        doc.setFillColor(...C.mist);
        doc.roundedRect(x, ty, cw, 54, 6, 6, 'FD');
        doc.setTextColor(...C.slate);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(doc.splitTextToSize(String(t(tile.label)).toUpperCase(), cw - 14)[0], x + 7, ty + 15);
        doc.setTextColor(...C.forest);
        let fs = 15;
        doc.setFontSize(fs);
        while (fs > 7 && doc.getTextWidth(String(tile.value)) > cw - 14) doc.setFontSize((fs -= 0.5));
        doc.text(String(tile.value), x + 7, ty + 35);
        if (tile.sub) {
          doc.setTextColor(...C.slate);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text(doc.splitTextToSize(String(t(tile.sub)), cw - 14)[0], x + 7, ty + 47);
        }
      });
      y += rowsN * 62 + 8;
    } else if (s.type === 'charts') {
      const charts = s.root ? chartImages(s.root, s.dark) : [];
      if (charts.length) {
        heading(s.title || t('Overview'));
        const cols = landscape ? 2 : 1;
        const gap = 12;
        const w = (inner - gap * (cols - 1)) / cols;
        let col = 0;
        let rowH = 0;
        for (const ch of charts) {
          const h = Math.min(w * ch.ratio, 230);
          if (col === 0) room(h + 12);
          doc.addImage(ch.data, 'PNG', M + col * (w + gap), y, w, h);
          rowH = Math.max(rowH, h);
          col += 1;
          if (col === cols) { y += rowH + 12; col = 0; rowH = 0; }
        }
        if (col) y += rowH + 12;
      }
    } else if (s.type === 'table' && s.rows?.length) {
      heading(s.title || t('Detail'));
      const n = s.headers.length;
      autoTable(doc, {
        startY: y,
        head: [s.headers.map((h) => String(t(h)))],
        body: s.rows.map((r) => r.map(clean)),
        margin: { left: M, right: M, bottom: 40, top: M },
        tableWidth: inner,
        columnStyles: fitColumns(s.headers, s.rows, inner),
        styles: { font: 'helvetica', fontSize: n > 12 ? 6.5 : n > 9 ? 7.2 : n > 6 ? 8 : 8.8, textColor: C.ink, lineColor: C.fern, lineWidth: 0.4, cellPadding: n > 9 ? 3 : 4.5, overflow: 'linebreak', valign: 'top' },
        headStyles: { fillColor: C.forest, textColor: C.white, fontStyle: 'bold', valign: 'middle' },
        alternateRowStyles: { fillColor: C.mist },
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
      });
      y = doc.lastAutoTable.finalY + 16;
    } else if (s.type === 'pairs' && s.rows?.length) {
      heading(s.title);
      autoTable(doc, {
        startY: y,
        body: s.rows.map(([a, b]) => [String(t(a)), clean(b)]),
        margin: { left: M, right: M, bottom: 40, top: M },
        tableWidth: inner,
        columnStyles: { 0: { cellWidth: inner * 0.38, fontStyle: 'bold', textColor: C.forest }, 1: { cellWidth: inner * 0.62 } },
        styles: { font: 'helvetica', fontSize: 9.5, textColor: C.ink, lineColor: C.fern, lineWidth: 0.4, cellPadding: 5, overflow: 'linebreak' },
        alternateRowStyles: { fillColor: C.mist },
      });
      y = doc.lastAutoTable.finalY + 16;
    } else if (s.type === 'text' && s.text) {
      heading(s.title);
      y += 4;
      paragraph(s.text);
      y += 10;
    } else if (s.type === 'list' && s.items?.length) {
      heading(s.title);
      y += 6;
      s.items.forEach((it, i) => {
        const head = typeof it === 'string' ? '' : it.head;
        const body = typeof it === 'string' ? it : it.body;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...C.leaf);
        room(30);
        doc.text(s.numbered ? `${i + 1}.` : '•', M + 2, y + 4);
        if (head) {
          doc.setTextColor(...C.forest);
          const hl = doc.splitTextToSize(String(head), inner - 24);
          doc.text(hl, M + 20, y + 4);
          y += hl.length * 13;
        }
        if (body) paragraph(body, M + 20, inner - 24, 9.5);
        y += 4;
      });
      y += 6;
    } else if (s.type === 'image' && s.data) {
      try {
        const size = Math.min(200, inner * 0.5);
        room(size + 12);
        doc.addImage(s.data, 'JPEG', M, y, size, size, undefined, 'FAST');
        doc.setDrawColor(...C.fern);
        doc.roundedRect(M, y, size, size, 4, 4, 'S');
        y += size + 14;
      } catch { /* unsupported image: the report goes without the photo */ }
    } else if (s.type === 'note' && s.text) {
      doc.setFontSize(8.5);
      const note = doc.splitTextToSize(s.text, inner - 20);
      room(note.length * 11 + 22);
      doc.setDrawColor(...C.amber);
      doc.roundedRect(M, y, inner, note.length * 11 + 14, 6, 6, 'S');
      doc.setTextColor(...C.slate);
      doc.text(note, M + 10, y + 15);
      y += note.length * 11 + 24;
    }
  }

  drawFooters(doc, W, H, M, o.title);
  doc.save(o.fileName);
}

/**
 * The Reports page: key figures, charts of the page and the full detail table.
 * @param {object} o { title, subtitle, owner, tiles, headers, rows, chartRoot, dark, fileName, sections? }
 */
export function downloadReportPdf(o) {
  return downloadDocPdf({
    kind: t('Report'),
    title: o.title,
    meta: [o.owner, o.subtitle],
    fileName: o.fileName,
    sections: o.sections || [
      { type: 'tiles', tiles: o.tiles },
      { type: 'charts', root: o.chartRoot, dark: o.dark, title: t('Overview') },
      { type: 'table', title: t('Detail'), headers: o.headers || [], rows: o.rows || [] },
    ],
  });
}

/** A calculator result with the explanation: inputs, results, meaning, plan, farm link, weather. */
export function downloadCalculatorPdf({ calc, inputs, results, report, owner, field, fileName }) {
  const sections = [
    { type: 'pairs', title: t('Inputs'), rows: inputs },
    { type: 'tiles', tiles: results.map((r) => ({ label: r.label, value: r.value })) },
  ];
  if (report) {
    sections.push({ type: 'text', title: t('In short'), text: report.headline });
    if (report.meaning?.length) sections.push({ type: 'table', title: t('What the results mean'), headers: ['Result', 'Meaning'], rows: report.meaning.map((m) => [m.result, m.explanation]) });
    if (report.estimates?.length) sections.push({ type: 'table', title: t('Other estimates'), headers: ['Estimate', 'Value', 'How it was worked out'], rows: report.estimates.map((e) => [e.label, e.value, e.note]) });
    if (report.recommendations?.length) sections.push({ type: 'list', numbered: true, title: t('Recommended steps'), items: report.recommendations.map((r) => ({ head: r.action, body: r.detail })) });
    if (report.farm_link) sections.push({ type: 'text', title: t('Your farm'), text: report.farm_link });
    if (report.weather_note) sections.push({ type: 'text', title: t('Weather'), text: report.weather_note });
    if (report.cautions?.length) sections.push({ type: 'list', title: t('Watch out for'), items: report.cautions });
    if (report.assumptions?.length) sections.push({ type: 'list', title: t('Assumptions'), items: report.assumptions });
  }
  sections.push({ type: 'note', text: t('These figures are estimates for planning. Check them against local recommendations for your crop, soil and weather before you buy or apply anything.') });
  return downloadDocPdf({ kind: t('Calculation report'), title: t(calc.title), meta: [owner, field && `${t('Field')}: ${field}`], sections, fileName, landscape: false });
}

/**
 * Disease analysis report: cause, treatment, medication and how to give it, with the photo.
 * @param {object} o { report, photoUrl, crop, context, owner, fileName }
 */
export async function downloadDiagnosisPdf(o) {
  const r = o.report;
  const photo = o.photoUrl ? await loadImage(o.photoUrl).catch(() => null) : null;
  const sections = [
    { type: 'tiles', tiles: [{ label: 'Type', value: t(r.problem_type) }, { label: 'Severity', value: t(r.severity) }, { label: 'Confidence', value: t(r.confidence) }] },
    photo ? { type: 'image', data: photo } : null,
    { type: 'text', title: t('What is happening'), text: r.overview },
    { type: 'text', title: t('Affected part'), text: r.affected_part },
    r.visible_signs?.length ? { type: 'list', title: t('What the photo shows'), items: r.visible_signs } : null,
    { type: 'text', title: t('Cause'), text: r.cause },
    { type: 'text', title: t('Treatment'), text: r.treatment },
    { type: 'text', title: t('Medication'), text: r.medication },
    { type: 'text', title: t('How to give it'), text: r.how_to_give },
    { type: 'text', title: t('Prevention'), text: r.prevention },
    r.other_possibilities?.length ? { type: 'text', title: t('Other possibilities'), text: r.other_possibilities.join(' · ') } : null,
    { type: 'text', title: t('Your farm'), text: r.farm_link },
    { type: 'text', title: t('When to get expert help'), text: r.when_to_get_help },
    r.follow_up_days ? { type: 'text', title: t('Follow up'), text: t('Check the crop again in {{count}} days.', { count: r.follow_up_days }) } : null,
    { type: 'note', text: t('AI advice is a guide, not a prescription. Follow product labels and local rules, and ask an agronomist or vet for serious problems. The text you send is processed by our AI service.') },
  ].filter(Boolean);
  return downloadDocPdf({
    kind: t('Farm photo report'), title: r.title, meta: [o.crop, o.context, o.owner], sections, fileName: o.fileName, landscape: false,
  });
}
