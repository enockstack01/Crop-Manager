import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { AGRICODERS_DISC } from './brandImages';
import { mediaUrl } from '../env';
import { t } from '../i18n';

/*
 * Branded PDFs on the Agricoders template: one Pine header band with the Agricoders disc and the CropManager
 * name shown once, Forest headings and table headers, Mist alternate rows, Amber for the single highlight.
 * The footer carries only the report title. Wide tables switch the page to landscape, columns share the
 * width by content and long text wraps, so nothing is cut off. Carlito/Calibri/Arial font stack.
 */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const para = (s: unknown) => esc(s).replace(/\n/g, '<br/>');
const cellText = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

export type PdfSection =
  | { type: 'tiles'; tiles: { label: string; value: string; sub?: string }[] }
  | { type: 'table'; title: string; headers: string[]; rows: any[][] }
  | { type: 'pairs'; title: string; rows: [string, any][] }
  | { type: 'text'; title: string; text?: string }
  | { type: 'list'; title: string; items: (string | { head: string; body?: string })[]; numbered?: boolean }
  | { type: 'image'; url: string }
  | { type: 'note'; text: string };

const wide = (sections: PdfSection[]) =>
  sections.some((s) => s.type === 'table' && (s.headers.length > 6 || s.rows.reduce((m, r) => Math.max(m, r.reduce((a, c) => a + String(c ?? '').length, 0)), 0) > 110));

function body(s: PdfSection): string {
  if (s.type === 'tiles') {
    if (!s.tiles.length) return '';
    return `<div class="tiles">${s.tiles.map((x) => `<div class="tile"><div class="tl">${esc(t(x.label)).toUpperCase()}</div><div class="tv">${esc(x.value)}</div>${x.sub ? `<div class="ts">${esc(t(x.sub))}</div>` : ''}</div>`).join('')}</div>`;
  }
  if (s.type === 'table') {
    if (!s.rows.length) return '';
    const n = s.headers.length;
    const size = n > 12 ? 7 : n > 9 ? 8 : n > 6 ? 9 : 10.5;
    return `<div class="sec"><h3>${esc(s.title)}</h3><table style="font-size:${size}px"><thead><tr>${s.headers.map((h) => `<th>${esc(t(h))}</th>`).join('')}</tr></thead><tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(cellText(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if (s.type === 'pairs') {
    if (!s.rows.length) return '';
    return `<div class="sec"><h3>${esc(s.title)}</h3><table class="pairs"><tbody>${s.rows.map(([a, b]) => `<tr><th>${esc(t(a))}</th><td>${esc(cellText(b))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  if (s.type === 'text') return s.text ? `<div class="sec"><h3>${esc(s.title)}</h3><p>${para(s.text)}</p></div>` : '';
  if (s.type === 'list') {
    if (!s.items.length) return '';
    const items = s.items.map((i) => (typeof i === 'string' ? `<li>${esc(i)}</li>` : `<li><b>${esc(i.head)}</b>${i.body ? `<br/>${para(i.body)}` : ''}</li>`)).join('');
    return `<div class="sec"><h3>${esc(s.title)}</h3>${s.numbered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`}</div>`;
  }
  if (s.type === 'image') return s.url ? `<div class="sec"><img class="photo" src="${esc(s.url)}"/></div>` : '';
  if (s.type === 'note') return s.text ? `<div class="note">${esc(s.text)}</div>` : '';
  return '';
}

function html(o: { kind: string; title: string; meta?: (string | undefined | null)[]; sections: PdfSection[] }) {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const meta = (o.meta || []).filter(Boolean).map(esc).join(' &middot; ');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  @page { margin: 0 }
  body { font-family: Carlito, Calibri, Arial, sans-serif; color: #1C2B1E; margin: 0; font-size: 12px; line-height: 1.45 }
  .band { background: #14532D; color: #fff; padding: 14px 32px; display: flex; align-items: center; justify-content: space-between }
  .band .l { display: flex; align-items: center; gap: 12px }
  .band img { width: 40px; height: 40px }
  .band .n { font-size: 20px; font-weight: 700 }
  .band .r { text-align: right; font-size: 10px }
  .band .r b { display: block; letter-spacing: 1.5px; font-size: 9px }
  .accent { height: 3px; width: 110px; background: #F9A825 }
  .body { padding: 18px 32px 60px }
  h1 { font-size: 22px; color: #1B5E20; margin: 0 0 4px }
  .meta { color: #5B6B5D; font-size: 11px; padding-bottom: 10px; border-bottom: 1px solid #D5E3D6; margin-bottom: 14px }
  .tiles { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px }
  .tile { flex: 1 1 130px; background: #F3F8F3; border: 1px solid #D5E3D6; border-radius: 6px; padding: 8px 10px }
  .tl { font-size: 8px; font-weight: 700; color: #5B6B5D; letter-spacing: .4px }
  .tv { font-size: 15px; font-weight: 700; color: #1B5E20; margin-top: 3px; word-break: break-word }
  .ts { font-size: 8px; color: #5B6B5D }
  .sec { margin-top: 14px }
  .sec h3 { font-size: 13px; color: #1B5E20; margin: 0 0 6px }
  .sec p { margin: 0 0 0 4px }
  table { width: 100%; border-collapse: collapse; table-layout: auto }
  th { background: #1B5E20; color: #fff; text-align: left; font-weight: 700; padding: 4px 5px; vertical-align: middle }
  td { border: 1px solid #D5E3D6; padding: 4px 5px; vertical-align: top; word-break: break-word }
  tbody tr:nth-child(even) td { background: #F3F8F3 }
  tr { break-inside: avoid }
  thead { display: table-header-group }
  table.pairs th { background: transparent; color: #1B5E20; width: 36%; border: 1px solid #D5E3D6 }
  ol, ul { margin: 0; padding-left: 20px } li { margin-bottom: 6px }
  .photo { width: 180px; height: 180px; object-fit: cover; border-radius: 6px; border: 1px solid #D5E3D6 }
  .note { margin-top: 18px; padding: 8px 12px; border: 1px solid #F9A825; border-radius: 8px; font-size: 10px; color: #5B6B5D }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; padding: 8px 32px; border-top: 1px solid #D5E3D6; font-size: 9px; color: #5B6B5D; background: #fff }
  </style></head><body>
  <div class="band"><div class="l"><img src="${AGRICODERS_DISC}"/><div class="n">CropManager</div></div><div class="r"><b>${esc(String(o.kind).toUpperCase())}</b>${esc(date)}</div></div>
  <div class="accent"></div>
  <div class="body"><h1>${esc(o.title)}</h1>${meta ? `<div class="meta">${meta}</div>` : ''}${o.sections.map(body).join('')}</div>
  <div class="foot">${esc(o.title)}</div>
  </body></html>`;
}

/** Builds the PDF and opens the share sheet (save to files, WhatsApp, email...). */
export async function sharePdf(o: { kind: string; title: string; meta?: (string | undefined | null)[]; sections: PdfSection[]; landscape?: boolean }) {
  const landscape = o.landscape ?? wide(o.sections);
  const { uri } = await Print.printToFileAsync({ html: html(o), width: landscape ? 842 : 595, height: landscape ? 595 : 842 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: o.title, UTI: 'com.adobe.pdf' });
  }
  return uri;
}

/** A report: key figures and every table, with the crop and filters in the heading. */
export const shareReportPdf = (o: { title: string; subtitle?: string; owner?: string; tiles: { label: string; value: string; sub?: string }[]; tables: { title: string; headers: string[]; rows: any[][] }[] }) =>
  sharePdf({
    kind: t('Report'),
    title: o.title,
    meta: [o.owner, o.subtitle],
    sections: [{ type: 'tiles', tiles: o.tiles }, ...o.tables.filter((x) => x.rows.length).map((x) => ({ type: 'table' as const, title: t(x.title), headers: x.headers, rows: x.rows }))],
  });

/** A calculator result with the explanation: inputs, results, meaning, plan, farm link, weather. */
export function shareCalculatorPdf(o: { title: string; inputs: [string, any][]; results: { label: string; value: string }[]; report?: any; owner?: string; field?: string }) {
  const r = o.report;
  const sections: PdfSection[] = [
    { type: 'pairs', title: t('Inputs'), rows: o.inputs },
    { type: 'tiles', tiles: o.results.map((x) => ({ label: x.label, value: x.value })) },
  ];
  if (r) {
    sections.push({ type: 'text', title: t('In short'), text: r.headline });
    if (r.meaning?.length) sections.push({ type: 'table', title: t('What the results mean'), headers: ['Result', 'Meaning'], rows: r.meaning.map((m: any) => [m.result, m.explanation]) });
    if (r.estimates?.length) sections.push({ type: 'table', title: t('Other estimates'), headers: ['Estimate', 'Value', 'How it was worked out'], rows: r.estimates.map((e: any) => [e.label, e.value, e.note]) });
    if (r.recommendations?.length) sections.push({ type: 'list', numbered: true, title: t('Recommended steps'), items: r.recommendations.map((x: any) => ({ head: x.action, body: x.detail })) });
    if (r.farm_link) sections.push({ type: 'text', title: t('Your farm'), text: r.farm_link });
    if (r.weather_note) sections.push({ type: 'text', title: t('Weather'), text: r.weather_note });
    if (r.cautions?.length) sections.push({ type: 'list', title: t('Watch out for'), items: r.cautions });
    if (r.assumptions?.length) sections.push({ type: 'list', title: t('Assumptions'), items: r.assumptions });
  }
  sections.push({ type: 'note', text: t('These figures are estimates for planning. Check them against local recommendations for your crop, soil and weather before you buy or apply anything.') });
  return sharePdf({ kind: t('Calculation report'), title: o.title, meta: [o.owner, o.field ? `${t('Field')}: ${o.field}` : ''], sections, landscape: false });
}

/** Disease analysis report: which part is affected, what shows, cause, treatment, medication, how to give it. */
export function shareDiagnosisPdf(r: any, opts: { photoUrl?: string | null; crop?: string; owner?: string }) {
  const photo = opts.photoUrl ? mediaUrl(opts.photoUrl) : null;
  const sections: PdfSection[] = [
    { type: 'tiles', tiles: [{ label: 'Type', value: t(r.problem_type) }, { label: 'Severity', value: t(r.severity) }, { label: 'Confidence', value: t(r.confidence) }] },
    ...(photo ? [{ type: 'image' as const, url: photo }] : []),
    { type: 'text', title: t('Affected part'), text: r.affected_part },
    ...(r.visible_signs?.length ? [{ type: 'list' as const, title: t('What the photo shows'), items: r.visible_signs }] : []),
    { type: 'text', title: t('Cause'), text: r.cause },
    { type: 'text', title: t('Treatment'), text: r.treatment },
    { type: 'text', title: t('Medication'), text: r.medication },
    { type: 'text', title: t('How to give it'), text: r.how_to_give },
    { type: 'text', title: t('Prevention'), text: r.prevention },
    ...(r.other_possibilities?.length ? [{ type: 'text' as const, title: t('Other possibilities'), text: r.other_possibilities.join(' · ') }] : []),
    { type: 'text', title: t('When to get expert help'), text: r.when_to_get_help },
    ...(r.follow_up_days ? [{ type: 'text' as const, title: t('Follow up'), text: t('Check the crop again in {{count}} days.', { count: r.follow_up_days }) }] : []),
    { type: 'note', text: t('AI advice is a guide, not a prescription. Follow product labels and local rules, and ask an agronomist or vet for serious problems. The text you send is processed by our AI service.') },
  ];
  return sharePdf({ kind: t('Disease analysis report'), title: r.title, meta: [opts.crop, opts.owner], sections, landscape: false });
}
