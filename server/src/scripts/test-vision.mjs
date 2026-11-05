/**
 * Unit tests for the disease-classifier wrapper (src/lib/vision), run against a stubbed Space: no network,
 * no token, no database.
 *
 *   node src/scripts/test-vision.mjs
 */
import sharp from 'sharp';

process.env.HF_SPACE_ID = 'test/space';
process.env.HF_TOKEN = 'hf_TESTTOKEN123456';
process.env.HF_TIMEOUT_MS = '150';
delete process.env.VISION_ENABLED;

const { classify, describeLabel, validate, __test } = await import('../lib/vision/hfClient.js');
const { labelCropFor } = await import('../lib/vision/cropMap.js');

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

const photo = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#3a7d2c' } }).jpeg().toBuffer();
const REPLY = { model_version: 'vit-test', confident: true, predictions: [{ label: 'maize_gray_leaf_spot', confidence: 0.91 }, { label: 'maize_common_rust', confidence: 0.05 }, { label: 'maize_healthy', confidence: 0.02 }] };

// the keys really present in labels.json
const keys = ['maize_gray_leaf_spot', 'maize_common_rust', 'maize_healthy'].filter((k) => describeLabel(k));
if (keys.length < 3) { console.log('labels.json has no such maize keys, finding some'); }
const real = (await import('node:fs')).default;
const L = JSON.parse(real.readFileSync(new URL('../lib/vision/labels.json', import.meta.url), 'utf8')).labels;
const maize = L.filter((l) => l.crop === 'Maize');
REPLY.predictions = maize.slice(0, 3).map((l, i) => ({ label: l.key, confidence: [0.91, 0.05, 0.02][i] }));

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };

const stub = (impl) => { const calls = []; __test.setConnect(async () => ({ predict: async (ep, payload) => { calls.push({ ep, payload }); return impl(payload, calls.length); } })); return calls; };
const fresh = () => { __test.reset(); warnings.length = 0; };

console.log('1. success');
fresh();
let calls = stub(async () => ({ data: [REPLY] }));
let r = await classify(photo, { crop: 'Maize', lang: 'rw' });
ok(r && r.predictions.length === 3, 'returns the three predictions');
ok(r.model_version === 'vit-test' && r.confident === true && r.unrecognised === false, 'keeps version and the confident / unrecognised flags');
ok(r.predictions[0].crop === 'Maize' && r.predictions[0].disease === maize[0].disease && r.predictions[0].part === maize[0].part, 'adds crop, disease and plant part');
ok(r.predictions[0].names.disease === (maize[0].names.rw?.disease || maize[0].disease), 'gives the disease name in the user\'s language');
ok(calls.length === 1 && calls[0].ep === '/classify' && calls[0].payload[1] === 'Maize', 'calls /classify once with the crop');
const sent = calls[0].payload[0];
const meta = await sharp(Buffer.from(await sent.arrayBuffer())).metadata();
ok(Math.max(meta.width, meta.height) === 1024 && meta.format === 'jpeg', 'sends a JPEG shrunk to 1024 px', JSON.stringify(meta));

console.log('2. unknown crop and language');
fresh();
calls = stub(async () => ({ data: [REPLY] }));
await classify(photo, { crop: 'Sunflower' });
ok(calls[0].payload[1] === '', 'a crop outside the 49 is sent as "" so the Space does not raise');
r = await classify(photo, { crop: 'Maize', lang: 'de' });
ok(r.predictions[0].names.disease === maize[0].names.en.disease, 'a language with no names falls back to English');
ok(labelCropFor('Irish potatoes') === 'Potato' && labelCropFor('corn') === 'Maize' && labelCropFor('beans') === 'Bean' && labelCropFor('sunflower') === '' && labelCropFor('sweet potato') === '', 'crop names map to classifier crops, uncovered crops to ""');

console.log('3. no token, switched off');
fresh();
calls = stub(async () => ({ data: [REPLY] }));
const tok = process.env.HF_TOKEN;
delete process.env.HF_TOKEN;
ok((await classify(photo, {})) === null && calls.length === 0, 'without HF_TOKEN returns null and never calls the Space');
process.env.HF_TOKEN = tok;
process.env.VISION_ENABLED = '0';
ok((await classify(photo, {})) === null && calls.length === 0, 'VISION_ENABLED=0 returns null');
delete process.env.VISION_ENABLED;

console.log('4. timeout and retry');
fresh();
calls = stub(() => new Promise(() => {}));
let t0 = Date.now();
r = await classify(photo, {});
ok(r === null, 'a Space that never answers gives null');
ok(calls.length === 2, 'tries twice (one retry)', `calls=${calls.length}`);
ok(Date.now() - t0 < 1500, 'and gives up on time');
fresh();
calls = stub(async (_, n) => { if (n === 1) throw new Error('queue full'); return { data: [REPLY] }; });
r = await classify(photo, {});
ok(r && calls.length === 2, 'the retry succeeds after one failure');

console.log('5. malformed replies');
for (const [name, reply] of [
  ['an empty object', { data: [{}] }],
  ['no data', {}],
  ['predictions that are not a list', { data: [{ predictions: 'x' }] }],
  ['only labels the app does not know', { data: [{ model_version: 'v', confident: true, predictions: [{ label: 'nope_nothing', confidence: 0.9 }] }] }],
  ['a confidence that is not a number', { data: [{ predictions: [{ label: maize[0].key, confidence: 'high' }] }] }],
  ['text that is not JSON', { data: ['<html>'] }],
]) {
  fresh();
  stub(async () => reply);
  ok((await classify(photo, {})) === null, `${name} gives null`);
}
fresh();
stub(async () => ({ data: [JSON.stringify(REPLY)] }));
ok((await classify(photo, {}))?.predictions.length === 3, 'a reply sent as a JSON string is accepted');
const mixed = validate([{ predictions: [{ label: 'nope', confidence: 0.5 }, { label: maize[0].key, confidence: 7 }, { label: maize[1].key, confidence: 0.2 }] }]);
ok(mixed.predictions.length === 2 && mixed.predictions[0].confidence === 1 && mixed.confident === false, 'drops unknown labels, clamps confidence to 0..1, confident defaults to false');

console.log('6. circuit breaker');
fresh();
calls = stub(async () => { throw new Error('boom'); });
for (let i = 0; i < 3; i += 1) await classify(photo, {});
const before = calls.length;
ok(before === 6 && __test.state().open, 'three failed calls open the breaker');
ok((await classify(photo, {})) === null && calls.length === before, 'while open the Space is not called');
const realNow = Date.now;
Date.now = () => realNow() + 61_000;
stub(async () => ({ data: [REPLY] }));
r = await classify(photo, {});
const stillOpen = __test.state().open;
Date.now = realNow;
ok(r !== null && !stillOpen, 'after 60 s it tries again and closes');

console.log('7. at most 4 calls at once');
fresh();
let live = 0;
let peak = 0;
stub(async () => { live += 1; peak = Math.max(peak, live); await new Promise((res) => setTimeout(res, 40)); live -= 1; return { data: [REPLY] }; });
const all = await Promise.all(Array.from({ length: 10 }, () => classify(photo, {})));
ok(all.every(Boolean), 'ten simultaneous photos are all answered');
ok(peak <= 4 && peak >= 2, `never more than 4 in flight (peak ${peak})`);

console.log('8. nothing sensitive in the logs');
fresh();
stub(async () => { throw new Error(`401 for token ${process.env.HF_TOKEN}`); });
await classify(photo, {});
ok(warnings.length > 0 && warnings.every((w) => !w.includes('TESTTOKEN')), 'the token is masked in the failure note');
ok(warnings.every((w) => w.split('\n').length === 1 && w.length < 260), 'one short line per failure');
ok((await classify(Buffer.from('not an image'), {})) === null, 'a file that is not an image gives null instead of throwing');

console.log('9. a background failure inside the Gradio client does not stop the API');
fresh();
const gradioErr = Object.assign(new Error('Connection errored out. fetch failed'), { stack: 'Error: Connection errored out. fetch failed\n    at Client.upload_files (file:///x/node_modules/@gradio/client/dist/index.js:601:13)' });
Promise.reject(gradioErr); // nobody awaits it, as in the real failure
await new Promise((r) => setTimeout(r, 50));
ok(true, 'the process is still running after an unhandled rejection from the Gradio client');
ok(warnings.some((w) => w.includes('Connection errored out')), 'it is noted in one line');
stub(async () => ({ data: [REPLY] }));
ok((await classify(photo, {}))?.predictions.length === 3, 'and the next classification works');

console.warn = origWarn;
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
