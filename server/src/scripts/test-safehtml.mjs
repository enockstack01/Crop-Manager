/**
 * The confirmation dialog shows its message as HTML, and names from users go into it. This checks that nothing but <strong> and <br> can get through:
 *
 *   node src/scripts/test-safehtml.mjs
 */
import { safeHtml } from '../../../client/src/lib/safeHtml.js';

let passed = 0;
let failed = 0;
const ok = (c, name, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${name}`); } else { failed += 1; console.log(`  FAIL ${name} ${extra}`); } };
const has = (s) => /<[a-z!/?]/i.test(s.replace(/<\/?strong>|<br\s*\/?>/gi, ''));

ok(safeHtml('Delete <strong>Alice</strong>?<br>Sure?') === 'Delete <strong>Alice</strong>?<br>Sure?', 'the formatting the dialogs use is kept');
ok(safeHtml('a<BR/>b<br />c</STRONG>') === 'a<BR/>b<br />c</STRONG>', 'the same tags in other spellings are kept');
const attacks = [
  '<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '<svg/onload=alert(1)>', '<iframe src="javascript:alert(1)"></iframe>',
  '<strong onmouseover=alert(1)>x</strong>', '<br onclick=alert(1)>', '<strong/onfocus=alert(1)>', '<a href="javascript:alert(1)">x</a>',
  '<!--<img src=x onerror=alert(1)>-->', '<<img src=x onerror=alert(1)>', '< img src=x>', '<object data=x>', '<math><mtext></mtext></math>',
];
for (const a of attacks) {
  const out = safeHtml(`Permanently delete <strong>${a}</strong>?`);
  ok(!has(out), `no tag gets through: ${a.slice(0, 40)}`, out);
}
ok(safeHtml('Tom & Jerry') === 'Tom & Jerry' && safeHtml('Tom &amp; Jerry') === 'Tom &amp; Jerry', 'an ampersand, escaped or not, reads as before');
ok(safeHtml('5 < 6 and 7 > 3') === '5 &lt; 6 and 7 > 3', 'a less-than sign in plain text is shown as text');
ok(safeHtml(null) === '' && safeHtml(undefined) === '' && safeHtml(42) === '42', 'empty and odd values are handled');
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
