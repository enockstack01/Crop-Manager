/**
 * Checks which server a release app talks to (src/lib/apiUrl.ts). No phone needed:
 *
 *   node mobile/scripts/test-apiurl.mjs
 */
import { PRODUCTION_API, PRODUCTION_ORIGIN, EMULATOR_API, isLocalAddress, pickApiUrl, pickApiOrigin } from '../src/lib/apiUrl.ts';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

console.log('1. addresses that only work on a developer machine');
for (const u of ['http://10.0.2.2:5000/api', 'http://192.168.1.140:5000/api', 'http://localhost:5000/api', 'http://127.0.0.1:5000', 'http://172.20.10.4:5000/api', 'http://10.1.2.3/api', 'http://mypc.local:5000/api']) ok(isLocalAddress(u), `${u} is a developer address`);
for (const u of ['https://crop.agricoders.com/api', 'https://example.org/api', 'http://203.0.113.5/api', 'https://172.32.0.1/api']) ok(!isLocalAddress(u), `${u} is a public address`);

console.log('2. a RELEASE app');
ok(pickApiUrl('http://10.0.2.2:5000/api', false) === PRODUCTION_API, 'the emulator address left in .env.local is ignored (the bug that stopped phones reaching the server)');
ok(pickApiUrl('http://192.168.1.140:5000/api', false) === PRODUCTION_API, 'so is a home-network address');
ok(pickApiUrl(undefined, false) === PRODUCTION_API && pickApiUrl('', false) === PRODUCTION_API, 'no setting at all uses the real server');
ok(pickApiUrl('https://crop.agricoders.com/api', false) === 'https://crop.agricoders.com/api', 'the real address is kept');
ok(pickApiUrl('https://staging.example.org/api', false) === 'https://staging.example.org/api', 'another public server (staging) is respected');

console.log('3. while developing');
ok(pickApiUrl('http://192.168.1.140:5000/api', true) === 'http://192.168.1.140:5000/api', 'the developer address is used on a developer machine');
ok(pickApiUrl(undefined, true) === EMULATOR_API, 'with no setting the emulator address is the default');

console.log('4. the picture address');
ok(pickApiOrigin('http://10.0.2.2:5000', PRODUCTION_API, false) === PRODUCTION_ORIGIN, 'a developer origin in a release app becomes the real origin');
ok(pickApiOrigin(undefined, PRODUCTION_API, false) === PRODUCTION_ORIGIN, 'with no origin it is taken from the API address');
ok(pickApiOrigin('https://crop.agricoders.com', PRODUCTION_API, false) === 'https://crop.agricoders.com', 'a public origin is kept');

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
