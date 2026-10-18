import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { AGRICODERS_DISC, CROPMANAGER_GLYPH } from './brandImages';
import { mediaUrl } from '../env';
import { t } from '../i18n';

/*
 * Disease analysis report as a PDF on the Agricoders template: Pine header band with the Agricoders
 * logo and the CropManager glyph, Forest headings, Fern borders, Amber disclaimer, brand footer.
 * Carlito/Calibri/Arial fallback stack, as in the guide.
 */
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const para = (s: unknown) => esc(s).replace(/\n/g, '<br/>');

function html(r: any, o: { photo?: string | null; crop?: string; owner?: string }) {
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const sevColor = r.severity === 'High' || r.severity === 'Critical' ? '#C62828' : r.severity === 'Medium' ? '#F9A825' : '#2E7D32';
  const sevInk = r.severity === 'Medium' ? '#1C2B1E' : '#FFFFFF';
  const section = (title: string, text?: string) =>
    text ? `<div class="sec"><h3>${esc(t(title))}</h3><p>${para(text)}</p></div>` : '';
  const meta = [o.crop, o.owner, `${t('Generated')} ${date}`].filter(Boolean).map(esc).join(' &middot; ');
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  @page { margin: 0 }
  body { font-family: Carlito, Calibri, Arial, sans-serif; color: #1C2B1E; margin: 0; font-size: 13px; line-height: 1.5 }
  .band { background: #14532D; color: #fff; padding: 22px 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #14532D }
  .band .l { display: flex; align-items: center; gap: 16px }
  .band img.disc { width: 64px; height: 64px }
  .band img.glyph { width: 52px; height: 52px }
  .band .a { font-size: 9px; letter-spacing: 3px; font-weight: 700 }
  .band .n { font-size: 24px; font-weight: 700; margin-top: 2px }
  .band .s { font-size: 11px }
  .accent { height: 3px; width: 120px; background: #F9A825 }
  .body { padding: 26px 40px 70px }
  .kicker { font-size: 9px; letter-spacing: 2px; font-weight: 700; color: #5B6B5D }
  .head { display: flex; gap: 18px; justify-content: space-between; margin-top: 8px }
  h1 { font-size: 24px; color: #1B5E20; margin: 0 0 6px }
  .meta { color: #5B6B5D; font-size: 12px }
  .pills { margin-top: 12px }
  .pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 11px; margin-right: 6px }
  .photo { width: 120px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #D5E3D6 }
  .sec { margin-top: 18px; break-inside: avoid }
  .sec h3 { font-size: 14px; color: #1B5E20; margin: 0 0 6px; padding-bottom: 5px; border-bottom: 1px solid #D5E3D6 }
  .sec p { margin: 0; padding-left: 12px }
  .note { margin-top: 24px; padding: 10px 14px; border: 1px solid #F9A825; border-radius: 8px; font-size: 11px; color: #5B6B5D }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 40px; border-top: 1px solid #D5E3D6; font-size: 10px; color: #5B6B5D; background: #fff }
  </style></head><body>
  <div class="band"><div class="l"><img class="disc" src="${AGRICODERS_DISC}"/><div><div class="a">AGRICODERS</div><div class="n">CropManager</div><div class="s">${esc(t('by Agricoders'))}</div></div></div><img class="glyph" src="${CROPMANAGER_GLYPH}"/></div>
  <div class="accent"></div>
  <div class="body">
    <div class="kicker">${esc(t('DISEASE ANALYSIS REPORT'))}</div>
    <div class="head"><div><h1>${esc(r.title)}</h1><div class="meta">${meta}</div>
      <div class="pills"><span class="pill" style="background:#1B5E20;color:#fff">${esc(t(r.problem_type))}</span><span class="pill" style="background:${sevColor};color:${sevInk}">${esc(t('Severity'))}: ${esc(t(r.severity))}</span><span class="pill" style="background:#F3F8F3;color:#5B6B5D;border:1px solid #D5E3D6">${esc(t('Confidence'))}: ${esc(t(r.confidence))}</span></div></div>
      ${o.photo ? `<img class="photo" src="${esc(o.photo)}"/>` : ''}</div>
    ${section('Cause', r.cause)}${section('Treatment', r.treatment)}${section('Medication', r.medication)}${section('How to give it', r.how_to_give)}${section('Prevention', r.prevention)}
    ${r.other_possibilities?.length ? section('Other possibilities', r.other_possibilities.join(' · ')) : ''}
    ${section('When to get expert help', r.when_to_get_help)}
    ${r.follow_up_days ? section('Follow up', t('Check the crop again in {{count}} days.', { count: r.follow_up_days })) : ''}
    <div class="note">${esc(t('AI advice is a guide, not a prescription. Follow product labels and local rules, and ask an agronomist or vet for serious problems. The text you send is processed by our AI service.'))}</div>
  </div>
  <div class="foot">CropManager &middot; by Agricoders &middot; www.agricoders.com</div>
  </body></html>`;
}

/** Builds the PDF and opens the share sheet (save to files, WhatsApp, email...). */
export async function shareDiagnosisPdf(report: any, opts: { photoUrl?: string | null; crop?: string; owner?: string }) {
  const photo = opts.photoUrl ? mediaUrl(opts.photoUrl) : null;
  const { uri } = await Print.printToFileAsync({ html: html(report, { photo, crop: opts.crop, owner: opts.owner }) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('Disease analysis report'), UTI: 'com.adobe.pdf' });
  }
  return uri;
}
