/**
 * Does the AI service answer? A tiny real request through the same code the app uses (costs a fraction of a cent):
 *
 *   node src/scripts/check-ai-connection.mjs
 *
 * Reports whether a key is set, which tier/model setting is saved in the database (the saved admin setting overrides the code),
 * and the exact answer or error from the service for each tier. The key is never printed.
 */
import { connectDB } from '../config/db.js';
import { aiConfigured, askText } from '../lib/ai/client.js';
import { TIERS, getModelSettings } from '../lib/ai/models.js';

console.log(`AI key set in this environment: ${aiConfigured() ? 'yes' : 'NO (set AI_API_KEY)'}`);
if (!aiConfigured()) process.exit(1);
await connectDB();
let saved = null;
try { saved = await getModelSettings(); } catch { /* older code path */ }
console.log('saved tier setting (database):', saved ? JSON.stringify(saved) : '(none, using the built-in defaults)');
let bad = 0;
for (const tier of Object.keys(TIERS || { fast: 1, balanced: 1, advanced: 1, expert: 1 })) {
  const t0 = Date.now();
  try {
    const out = await askText({ task: tier === 'fast' ? 'chat' : 'report', system: [{ type: 'text', text: 'Answer in one word.' }], messages: [{ role: 'user', content: 'Say OK.' }], maxTokens: 20 });
    console.log(`PASS  ${tier.padEnd(9)} answered in ${Date.now() - t0} ms: ${String(out.text ?? out).slice(0, 30).replace(/\s+/g, ' ')}`);
  } catch (e) {
    bad += 1;
    console.log(`FAIL  ${tier.padEnd(9)} status ${e.status ?? e.statusCode ?? '?'} code ${e.details?.code ?? e.code ?? ''}: ${String(e.message).slice(0, 160)}`);
  }
}
process.exit(bad ? 1 : 0);
