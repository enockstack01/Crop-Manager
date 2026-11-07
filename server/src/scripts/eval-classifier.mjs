/**
 * Accuracy of the disease classifier, from a review.csv written by photo-review.mjs. Works offline on the file; no service is called.
 *
 *   node src/scripts/eval-classifier.mjs <review.csv> [--out report.md]
 *
 * Reports: top-1 and top-3 accuracy overall and per crop, accuracy by confidence band (does "90%" really mean right nine times in ten?),
 * how often the "confident" flag was right, the photos it called unrecognised, and the classes it confuses most. If the agronomist has
 * filled the verdict column, a second table counts those verdicts too.
 *
 * CAUTION: numbers are only as honest as the photos. Photos taken from the training set overstate real-world accuracy; judge the model on
 * field photos it has never seen.
 */
import fs from 'node:fs';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const file = process.argv[2];
if (!file) { console.error('Usage: node src/scripts/eval-classifier.mjs <review.csv> [--out report.md]'); process.exit(1); }
const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : '';
const all = parseCsv(fs.readFileSync(file, 'utf8'));
const answered = all.filter((r) => r.source === 'classifier' && r['top1 label']);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const truthOf = (r) => norm(r['folder_label (truth)'].replace(/___/g, '_'));
const hit1 = (r) => r['top1 matches folder'] === 'yes';
const hit3 = (r) => hit1(r) || [r['top2 label'], r['top3 label']].some((l) => l && norm(l) === truthOf(r));
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const lines = [];
const p = (s = '') => lines.push(s);

p('# Classifier accuracy report');
p();
p(`Source: \`${file}\``);
p(`Photos in the file: ${all.length}. Answered by the classifier: ${answered.length}. Fell back to the assistant alone (no classifier answer): ${all.length - answered.length}.`);
p();
p('> Photos from the training set overstate real-world accuracy. Treat these figures as an upper bound.');
p();
p('## Overall');
p();
p('| Measure | Result |');
p('| --- | --- |');
p(`| Top-1 correct | ${pct(answered.filter(hit1).length, answered.length)} (${answered.filter(hit1).length} of ${answered.length}) |`);
p(`| Top-3 contains the truth | ${pct(answered.filter(hit3).length, answered.length)} |`);

const confident = answered.filter((r) => r.confident === 'true');
const unsure = answered.filter((r) => r.confident !== 'true');
p(`| Flagged confident | ${confident.length} photos, ${pct(confident.filter(hit1).length, confident.length)} correct |`);
p(`| Not confident | ${unsure.length} photos, ${pct(unsure.filter(hit1).length, unsure.length)} correct |`);
const unrec = answered.filter((r) => r.unrecognised === 'true');
p(`| Called unrecognised | ${unrec.length} photos |`);
p();

p('## By crop');
p();
p('| Crop | Photos | Top-1 | Top-3 |');
p('| --- | ---: | ---: | ---: |');
const byCrop = {};
for (const r of answered) (byCrop[r.crop] = byCrop[r.crop] || []).push(r);
for (const [crop, rows] of Object.entries(byCrop).sort((a, b) => b[1].length - a[1].length)) p(`| ${crop} | ${rows.length} | ${pct(rows.filter(hit1).length, rows.length)} | ${pct(rows.filter(hit3).length, rows.length)} |`);
p();

p('## Is the confidence honest?');
p();
p('| Top-1 confidence | Photos | Actually correct |');
p('| --- | ---: | ---: |');
for (const [lo, hi] of [[0, 40], [40, 60], [60, 80], [80, 95], [95, 101]]) {
  const rows = answered.filter((r) => Number(r['top1 %']) >= lo && Number(r['top1 %']) < hi);
  p(`| ${lo}–${Math.min(hi, 100)}% | ${rows.length} | ${pct(rows.filter(hit1).length, rows.length)} |`);
}
p();
p('A trustworthy model is right about as often as it says. A "95–100%" band that is right far less often than that means the confidence numbers should not be shown to farmers as probabilities.');
p();

p('## Most confused');
p();
const pairs = {};
for (const r of answered.filter((x) => !hit1(x))) {
  const k = `${r['folder_label (truth)']} → ${r['top1 label']}`;
  pairs[k] = (pairs[k] || 0) + 1;
}
const top = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 12);
if (top.length) { p('| Truth → model said | Photos |'); p('| --- | ---: |'); top.forEach(([k, n]) => p(`| ${k} | ${n} |`)); } else p('No mistakes in this file.');
p();

const judged = all.filter((r) => r['agronomist verdict (fill in)']);
p('## Agronomist verdicts');
p();
if (!judged.length) p('The verdict column is empty. Ask an agronomist to fill it in; then run this again to count their judgement instead of the folder name.');
else {
  const counts = {};
  judged.forEach((r) => { const v = r['agronomist verdict (fill in)'].trim().toLowerCase(); counts[v] = (counts[v] || 0) + 1; });
  p('| Verdict | Photos |'); p('| --- | ---: |');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([v, n]) => p(`| ${v} | ${n} |`));
}
const text = lines.join('\n');
console.log(text);
if (out) { fs.writeFileSync(out, `${text}\n`); console.error(`\nwritten to ${out}`); }
