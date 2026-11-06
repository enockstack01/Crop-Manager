/**
 * Checks the SHA-256 used to verify the offline assistant download (src/ml/checksum.ts) against Node's own. No phone needed:
 *
 *   node mobile/scripts/test-checksum.mjs
 */
import crypto from 'node:crypto';
import { Sha256 } from '../src/ml/checksum.ts';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };
const ref = (b) => crypto.createHash('sha256').update(b).digest('hex');
const bytes = (n, seed = 1) => { const b = new Uint8Array(n); let x = seed; for (let i = 0; i < n; i += 1) { x = (x * 1103515245 + 12345) >>> 0; b[i] = x >>> 24; } return b; };

console.log('1. known values and lengths around a block');
ok(new Sha256().digestHex() === ref(new Uint8Array(0)), 'the empty input');
ok(new Sha256().update(new TextEncoder().encode('abc')).digestHex() === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'the standard "abc" value');
let all = true;
for (const n of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 4096, 65537]) {
  const b = bytes(n, n);
  if (new Sha256().update(b).digestHex() !== ref(b)) { all = false; console.log('    differs at', n); }
}
ok(all, 'lengths either side of every padding boundary match Node');

console.log('2. in pieces');
const big = bytes(300_000, 7);
const h = new Sha256();
for (let i = 0; i < big.length; i += 4096) h.update(big.subarray(i, i + 4096));
ok(h.digestHex() === ref(big) && h.bytes === big.length, 'many 4 KB pieces give the same answer');
const odd = new Sha256();
for (let i = 0, step = 1; i < big.length; i += step, step = (step * 3 + 5) % 977 + 1) odd.update(big.subarray(i, Math.min(big.length, i + step)));
ok(odd.digestHex() === ref(big), 'pieces of odd sizes give the same answer');
const mid = new Sha256().update(big.subarray(0, 1000));
const first = mid.digestHex();
mid.update(big.subarray(1000));
ok(first === ref(big.subarray(0, 1000)) && mid.digestHex() === ref(big), 'asking for the checksum does not disturb it');

console.log('3. saved and restored (a download that resumes)');
const part = new Sha256();
part.update(big.subarray(0, 123_457));
const saved = JSON.parse(JSON.stringify(part.toState()));
const resumed = Sha256.fromState(saved);
resumed.update(big.subarray(123_457));
ok(resumed.digestHex() === ref(big), 'a restored checksum carries on to the right answer');
ok(resumed.bytes === big.length, 'and knows how many bytes it has seen');

console.log('4. a damaged file is noticed');
const damaged = big.slice();
damaged[200_000] ^= 1;
ok(new Sha256().update(damaged).digestHex() !== ref(big), 'one changed bit gives another checksum');

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
