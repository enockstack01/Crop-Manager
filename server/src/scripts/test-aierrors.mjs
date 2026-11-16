/**
 * Checks that failures of the AI service become messages a person can act on (server/src/lib/ai/client.js friendly()):
 *
 *   node src/scripts/test-aierrors.mjs
 */
import { friendly } from '../lib/ai/client.js';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };
const code = (e) => e.details?.code;
const quiet = console.error;
console.error = () => {};

const credit = friendly({ status: 400, message: '400 {"error":{"message":"Your credit balance is too low to access the API. Please go to Plans & Billing."}}' });
ok(code(credit) === 'ai_billing' && credit.status === 503, 'an empty account is reported as paused, not as a bad request');
ok(/no credit left/i.test(credit.message) && /administrator/i.test(credit.message), 'and the message tells the administrator what to do');
ok(!/anthropic|claude|api key/i.test(credit.message), 'and never names the provider');
ok(code(friendly({ status: 400, message: 'messages: text content blocks must be non-empty' })) === 'ai_bad_request', 'a genuinely bad request is still a bad request');
ok(code(friendly({ status: 401 })) === 'ai_auth', 'a rejected key is reported as a settings problem');
ok(code(friendly({ status: 429 })) === 'ai_busy' && code(friendly({ status: 529 })) === 'ai_busy', 'a busy service asks to try again');
ok(code(friendly({ status: 404 })) === 'ai_model', 'an unknown model is reported as such');
ok(code(friendly(new Error('socket hang up'))) === 'ai_failed', 'anything else is a plain failure');

console.error = quiet;
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
