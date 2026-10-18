import { t } from '../i18n/index.js';

/*
 * Branded PDF of a report (Agricoders Brand and Template Guidelines v1.0): Pine header band with the
 * Agricoders logo and the CropManager glyph, Forest titles and table headers, Mist alternate rows,
 * Leaf Green figures, and a "CropManager · by Agricoders" footer with page numbers on every page.
 * Built in the browser with jsPDF (loaded on demand); Helvetica stands in for Calibri, as Arial does
 * in the guide's font fallback.
 */
const C = {
  pine: [20, 83, 45], forest: [27, 94, 32], leaf: [46, 125, 50], amber: [249, 168, 37],
  ink: [28, 43, 30], slate: [91, 107, 93], mist: [243, 248, 243], fern: [213, 227, 214], white: [255, 255, 255],
};

async function loadImage(url) {
  const blob = await (await fetch(url)).blob();
  const data = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
  return data;
}


function drawHeader(doc, disc, glyph, W, M) {
  // header band: Agricoders logo (left), CropManager glyph (right)
  doc.setFillColor(...C.pine);
  doc.rect(0, 0, W, 96, 'F');
  doc.addImage(disc, 'PNG', M, 16, 64, 64);
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setCharSpace(3);
  doc.text('AGRICODERS', M + 78, 40);
  doc.setCharSpace(0);
  doc.setFontSize(22);
  doc.text('CropManager', M + 78, 64);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(t('by Agricoders'), M + 78, 80);
  doc.addImage(glyph, 'PNG', W - M - 52, 22, 52, 52);
  doc.setFillColor(...C.amber);
  doc.rect(0, 96, 120, 3, 'F');
}

/** Footer on every page: signature left, page numbers right. */
function drawFooters(doc, W, H, M) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.fern);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.slate);
    doc.text('CropManager · by Agricoders · www.agricoders.com', M, H - 20);
    doc.text(`${t('Page')} ${i} / ${pages}`, W - M, H - 20, { align: 'right' });
  }
}

const loadLogos = () => Promise.all([loadImage('/brand/agricoders-logo-disc.png'), loadImage('/brand/cropmanager-icon.png')]);

/**
 * Disease analysis report: cause, treatment, medication and how to give it, with the photo,
 * on the Agricoders template (both logos in the header, disclaimer at the end).
 * @param {object} o { report, photoUrl, crop, context, owner, fileName }
 */
export async function downloadDiagnosisPdf(o) {
  const [{ jsPDF }, [disc, glyph], photo] = await Promise.all([
    import('jspdf'),
    loadLogos(),
    o.photoUrl ? loadImage(o.photoUrl).catch(() => null) : Promise.resolve(null),
  ]);
  const r = o.report;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  drawHeader(doc, disc, glyph, W, M);

  let y = 128;
  doc.setTextColor(...C.slate);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setCharSpace(2);
  doc.text(t('DISEASE ANALYSIS REPORT'), M, y);
  doc.setCharSpace(0);
  y += 22;

  // title + photo side by side
  const textW = photo ? W - 2 * M - 120 : W - 2 * M;
  doc.setTextColor(...C.forest);
  doc.setFontSize(20);
  const titleLines = doc.splitTextToSize(r.title, textW);
  doc.text(titleLines, M, y);
  let ty = y + titleLines.length * 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.slate);
  const meta = [o.crop, o.context, o.owner, `${t('Generated')} ${date}`].filter(Boolean).join('  ·  ');
  const metaLines = doc.splitTextToSize(meta, textW);
  doc.text(metaLines, M, ty);
  ty += metaLines.length * 13 + 8;

  // status pills: Forest (type), Amber or Alert (severity), outlined (confidence)
  const pill = (text, x, fill, ink, border) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const w = doc.getTextWidth(text) + 20;
    doc.setFillColor(...fill);
    if (border) doc.setDrawColor(...border);
    doc.roundedRect(x, ty, w, 20, 10, 10, border ? 'FD' : 'F');
    doc.setTextColor(...ink);
    doc.text(text, x + 10, ty + 13.5);
    return x + w + 6;
  };
  let px = M;
  px = pill(t(r.problem_type), px, C.forest, C.white);
  const sevFill = r.severity === 'High' || r.severity === 'Critical' ? [198, 40, 40] : r.severity === 'Medium' ? C.amber : C.leaf;
  px = pill(`${t('Severity')}: ${t(r.severity)}`, px, sevFill, r.severity === 'Medium' ? C.ink : C.white);
  pill(`${t('Confidence')}: ${t(r.confidence)}`, px, C.mist, C.slate, C.fern);
  ty += 28;

  if (photo) {
    try {
      doc.addImage(photo, W - M - 108, y - 12, 108, 108, undefined, 'FAST');
      doc.setDrawColor(...C.fern);
      doc.roundedRect(W - M - 108, y - 12, 108, 108, 4, 4, 'S');
    } catch { /* unsupported image: report without the photo */ }
  }
  y = Math.max(ty, photo ? y + 108 : ty) + 6;

  const room = (h) => { if (y + h > H - 50) { doc.addPage(); y = M + 10; } };
  const block = (title, text) => {
    if (!text) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(String(text), W - 2 * M - 24);
    room(46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...C.forest);
    doc.text(title, M, y);
    y += 8;
    doc.setDrawColor(...C.fern);
    doc.line(M, y, W - M, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...C.ink);
    for (const line of lines) {
      room(16);
      doc.text(line, M + 12, y);
      y += 15;
    }
    y += 10;
  };

  block(t('Cause'), r.cause);
  block(t('Treatment'), r.treatment);
  block(t('Medication'), r.medication);
  block(t('How to give it'), r.how_to_give);
  block(t('Prevention'), r.prevention);
  if (r.other_possibilities?.length) block(t('Other possibilities'), r.other_possibilities.join(' · '));
  block(t('When to get expert help'), r.when_to_get_help);
  if (r.follow_up_days) block(t('Follow up'), t('Check the crop again in {{count}} days.', { count: r.follow_up_days }));

  // disclaimer box (Amber outline)
  const note = doc.splitTextToSize(t('AI advice is a guide, not a prescription. Follow product labels and local rules, and ask an agronomist or vet for serious problems. The text you send is processed by our AI service.'), W - 2 * M - 20);
  room(note.length * 12 + 24);
  doc.setDrawColor(...C.amber);
  doc.roundedRect(M, y, W - 2 * M, note.length * 12 + 16, 6, 6, 'S');
  doc.setFontSize(9);
  doc.setTextColor(...C.slate);
  doc.text(note, M + 10, y + 16);

  drawFooters(doc, W, H, M);
  doc.save(o.fileName);
}

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

/**
 * @param {object} o
 * @param {string} o.title      report title
 * @param {string} o.subtitle   filters line
 * @param {string} o.owner      farm or account name (optional)
 * @param {{label:string,value:string,sub?:string}[]} o.tiles
 * @param {string[]} o.headers  table headers
 * @param {any[][]} o.rows      table rows
 * @param {Element} o.chartRoot element whose canvases are drawn as charts
 * @param {boolean} o.dark
 * @param {string} o.fileName
 */
export async function downloadReportPdf(o) {
  const [{ jsPDF }, { default: autoTable }, [disc, glyph]] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogos(),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  drawHeader(doc, disc, glyph, W, M);

  // ---- title block
  let y = 128;
  doc.setTextColor(...C.forest);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(o.title, M, y);
  y += 20;
  doc.setTextColor(...C.slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const meta = [o.owner, o.subtitle, `${t('Generated')} ${date}`].filter(Boolean).join('  ·  ');
  const metaLines = doc.splitTextToSize(meta, W - 2 * M);
  doc.text(metaLines, M, y);
  y += metaLines.length * 13 + 8;
  doc.setDrawColor(...C.fern);
  doc.line(M, y, W - M, y);
  y += 18;

  // ---- key figures: bordered cards, Leaf figures
  const tiles = o.tiles || [];
  if (tiles.length) {
    const perRow = Math.min(4, tiles.length);
    const gap = 10;
    const cw = (W - 2 * M - gap * (perRow - 1)) / perRow;
    tiles.forEach((tile, i) => {
      const x = M + (i % perRow) * (cw + gap);
      const ty = y + Math.floor(i / perRow) * 64;
      doc.setDrawColor(...C.fern);
      doc.setFillColor(...C.mist);
      doc.roundedRect(x, ty, cw, 54, 6, 6, 'FD');
      doc.setTextColor(...C.slate);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(doc.splitTextToSize(String(t(tile.label)).toUpperCase(), cw - 16)[0], x + 8, ty + 16);
      doc.setTextColor(...C.forest);
      let fs = 15;
      doc.setFontSize(fs);
      while (fs > 8 && doc.getTextWidth(String(tile.value)) > cw - 16) doc.setFontSize((fs -= 0.5));
      doc.text(String(tile.value), x + 8, ty + 36);
      if (tile.sub) {
        doc.setTextColor(...C.slate);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(String(t(tile.sub)), x + 8, ty + 48);
      }
    });
    y += Math.ceil(tiles.length / perRow) * 64 + 20;
  }

  // ---- charts
  const section = (label) => {
    if (y > H - 120) { doc.addPage(); y = M + 10; }
    doc.setTextColor(...C.forest);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(label, M, y);
    y += 12;
  };
  const charts = o.chartRoot ? chartImages(o.chartRoot, o.dark) : [];
  if (charts.length) {
    section(t('Overview'));
    for (const ch of charts) {
      const w = W - 2 * M;
      const h = Math.min(w * ch.ratio, 260);
      if (y + h > H - 50) { doc.addPage(); y = M + 10; }
      doc.addImage(ch.data, 'PNG', M, y, w, h);
      y += h + 14;
    }
  }

  // ---- detail table
  if (o.rows?.length) {
    section(t('Detail'));
    autoTable(doc, {
      startY: y,
      head: [o.headers.map((h) => String(t(h)))],
      body: o.rows.map((r) => r.map((c) => (c === null || c === undefined || c === '' ? '—' : String(c)))),
      margin: { left: M, right: M, bottom: 44 },
      styles: { font: 'helvetica', fontSize: 8.5, textColor: C.ink, lineColor: C.fern, lineWidth: 0.4, cellPadding: 5 },
      headStyles: { fillColor: C.forest, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.mist },
    });
  }

  drawFooters(doc, W, H, M);

  doc.save(o.fileName);
}
