/**
 * Checks the Excel export writer that replaced the spreadsheet library:
 *
 *   node src/scripts/test-xlsx.mjs
 *
 * - the file is a valid zip (checksums, sizes, every part present) and every XML part is free of characters Excel refuses
 * - when Python with openpyxl is installed, the file is read back by that separate reader: values, number types, sheet names, the
 *   frozen header, the filter, colours and wrapping
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { buildXlsx, columnName, sheetNames, xmlText } from '../lib/xlsxWriter.js';
import { toXlsx } from '../lib/export.js';

let passed = 0;
let failed = 0;
const ok = (c, name, extra = '') => {
  if (c) { passed += 1; console.log(`  ok   ${name}`); } else { failed += 1; console.log(`  FAIL ${name} ${extra}`); }
};

/** Reads a zip written by the writer: returns { name: Buffer } and checks every checksum and size. */
function readZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const entries = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = {};
  let valid = true;
  for (let i = 0; i < entries; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return { valid: false, files: out };
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    const lnlen = buf.readUInt16LE(local + 26);
    const lxlen = buf.readUInt16LE(local + 28);
    const data = zlib.inflateRawSync(buf.subarray(local + 30 + lnlen + lxlen, local + 30 + lnlen + lxlen + csize));
    if (data.length !== usize || (zlib.crc32(data) >>> 0) !== crc) valid = false;
    out[name] = data;
    p += 46 + nlen;
  }
  return { valid, files: out };
}

console.log('1. small pieces');
ok(columnName(0) === 'A' && columnName(25) === 'Z' && columnName(26) === 'AA' && columnName(701) === 'ZZ' && columnName(702) === 'AAA', 'column letters');
ok(xmlText('a & b < c > "d"') === 'a &amp; b &lt; c &gt; &quot;d&quot;', 'XML special characters are escaped');
ok(xmlText('ok\u0000\u0008\u000B\u001Fend\uD800x') === 'okendx', 'control characters and a lone surrogate are dropped');
ok(xmlText('é ü 日本語 🌱') === 'é ü 日本語 🌱', 'accents, other scripts and emoji are kept');
ok(xmlText('x'.repeat(40000)).length === 32000, 'text is cut at the length Excel allows');
ok(JSON.stringify(sheetNames(['Farms', 'farms', 'A/B:C', '', 'x'.repeat(50)])) === JSON.stringify(['Farms', 'farms 2', 'A B C', 'Sheet', 'x'.repeat(28)]), 'sheet names: unique ignoring case, no forbidden characters, at most 31 characters');

console.log('2. the file');
const sheets = [
  { title: 'Crops & varieties', subtitle: 'Period: all records', headers: ['Name', 'Area (ha)', 'Notes', 'Code'], rows: [['Tomato', 12.5, 'Line 1\nLine 2 <fast>', '007'], ['Café ñ', 0, '', 'x'.repeat(40000)], ['日本語', -3, 'a\u0000b', null]] },
  { title: 'Empty', headers: ['Only', 'headers'], rows: [] },
  { title: 'crops & varieties', headers: [], rows: [] },
];
const xlsx = buildXlsx(sheets, { created: new Date('2026-11-21T08:00:00Z') });
const { valid, files } = readZip(xlsx);
ok(xlsx.subarray(0, 2).toString() === 'PK' && valid, 'it is a zip with correct checksums and sizes');
const need = ['[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml'];
ok(need.every((n) => files[n]), 'every part a workbook needs is there', Object.keys(files).join(','));
const bad = Object.entries(files).filter(([, d]) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(d.toString('utf8')));
ok(bad.length === 0, 'no XML part holds a character Excel refuses');
const s1 = files['xl/worksheets/sheet1.xml'].toString();
ok(s1.includes('Line 1\nLine 2 &lt;fast&gt;') && s1.includes('Café ñ') && s1.includes('<v>12.5</v>') && s1.includes('<v>-3</v>'), 'text is escaped, accents survive, numbers are numbers');
ok(/<pane ySplit="3" topLeftCell="A4"/.test(s1) && s1.includes('<autoFilter ref="A3:D6"/>'), 'the header row (row 3 under the title and subtitle) is frozen and filtered');
ok(files['xl/workbook.xml'].toString().includes('name="crops &amp; varieties 2"'), 'a second sheet with the same name gets a new one');
ok(files['xl/worksheets/sheet3.xml'].toString().includes('<sheetData>') && !files['xl/worksheets/sheet3.xml'].toString().includes('<autoFilter'), 'a sheet with no columns is still a valid sheet');
ok(buildXlsx([]).length > 500, 'no sheets at all still gives a valid workbook');

console.log('3. the export of records');
const viaExport = await toXlsx([{ title: 'Fields', headers: ['Name', 'Code', 'Area', 'Big'], rows: [['North', '007', '45', '12345678901234567890'], ['South', '1500', '2.5', 'a']] }], { subtitle: 'All records' });
const ex = readZip(viaExport);
const sx = ex.files['xl/worksheets/sheet1.xml'].toString();
ok(ex.valid && sx.includes('<v>45</v>') && sx.includes('<v>2.5</v>') && sx.includes('<v>1500</v>'), 'figures written as text become numbers');
ok(sx.includes('>007<') && sx.includes('>12345678901234567890<'), 'a code with a leading zero and a 20-digit number stay as text, unchanged');

console.log('4. read back by a separate spreadsheet reader');
const tmp = path.join(os.tmpdir(), `xlsx-test-${process.pid}.xlsx`);
fs.writeFileSync(tmp, xlsx);
const script = `
import json, sys
import openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
out = {'sheets': wb.sheetnames}
a = wb.worksheets[0]
out['title'] = a['A1'].value
out['title_bold'] = bool(a['A1'].font.b)
out['sub'] = a['A2'].value
out['head'] = [c.value for c in a[3]]
out['head_fill'] = a['A3'].fill.fgColor.rgb
out['head_color'] = a['A3'].font.color.rgb
out['rows'] = [[c.value for c in r] for r in a.iter_rows(min_row=4)]
out['num_types'] = [type(a['B4'].value).__name__, type(a['B5'].value).__name__, type(a['B6'].value).__name__]
out['wrap'] = bool(a['C4'].alignment.wrap_text)
out['stripe'] = a['A5'].fill.fgColor.rgb
out['freeze'] = a.freeze_panes
out['filter'] = a.auto_filter.ref
out['width_notes'] = a.column_dimensions['C'].width
out['empty_head'] = [c.value for c in wb.worksheets[1][1]]
print(json.dumps(out))
`;
let read = null;
for (const py of ['python', 'python3', 'py']) {
  const r = spawnSync(py, ['-c', script, tmp], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim().startsWith('{')) { read = JSON.parse(r.stdout); break; }
}
fs.rmSync(tmp, { force: true });
if (!read) {
  console.log('  (skipped: Python with openpyxl is not installed here; the structural checks above still ran)');
} else {
  ok(JSON.stringify(read.sheets) === JSON.stringify(['Crops & varieties', 'Empty', 'crops & varieties 2']), 'the reader sees the three sheets with their names');
  ok(read.title === 'Crops & varieties' && read.title_bold && read.sub === 'Period: all records' && JSON.stringify(read.head) === JSON.stringify(['Name', 'Area (ha)', 'Notes', 'Code']), 'title, subtitle and header row');
  ok(read.head_fill === 'FF1B5E20' && read.head_color === 'FFFFFFFF' && read.stripe === 'FFF3F8F3', 'green header with white text, striped rows');
  ok(read.rows[0][0] === 'Tomato' && read.rows[0][1] === 12.5 && read.rows[0][2] === 'Line 1\nLine 2 <fast>' && read.rows[0][3] === '007', 'a row comes back exactly: text, number, line break, a code with a leading zero');
  ok(read.rows[1][0] === 'Café ñ' && read.rows[1][1] === 0 && read.rows[1][2] === null && read.rows[1][3].length === 32000 && read.rows[2][0] === '日本語' && read.rows[2][1] === -3 && read.rows[2][2] === 'ab', 'accents, other scripts, zero, negatives, empty cells, the cut at 32000 characters and dropped control characters');
  ok(JSON.stringify(read.num_types) === '["float","int","int"]' || JSON.stringify(read.num_types) === '["int","int","int"]' || read.num_types.every((t) => ['int', 'float'].includes(t)), 'numbers are read as numbers');
  ok(read.wrap === true && read.freeze === 'A4' && read.filter === 'A3:D6' && read.width_notes >= 10, 'wrapped text, frozen header, filter and column width');
  ok(JSON.stringify(read.empty_head) === '["Empty",null]', 'a sheet with only headers opens');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
