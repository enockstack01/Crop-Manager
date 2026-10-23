/*
 * Translates the app's English text into the languages that have no hand-written dictionary, using the
 * platform's AI service (the key is read from server/.env; nothing secret is written to the repository).
 *
 *   python scripts/i18n/build.py                         first: lists every string (generated/keys.json)
 *   node scripts/i18n/ai_translate.mjs                   all languages, only strings with no translation yet
 *   node scripts/i18n/ai_translate.mjs ar de --force     redo the named languages from scratch
 *   python scripts/i18n/build.py                         then: write the locale files
 *
 * Output: scripts/i18n/generated/<lang>.json  (English text -> translation). Hand-written French, Kinyarwanda
 * and Swahili stay as they are; this fills their gaps. Translations should still be reviewed by a native speaker.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const GEN = path.join(HERE, 'generated');
dotenv.config({ path: path.join(ROOT, 'server', '.env') });

const key = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!key) { console.error('No AI_API_KEY in server/.env'); process.exit(1); }
const MODEL = process.env.AI_MODEL_BALANCED || 'claude-sonnet-5-5';
const client = new Anthropic({ apiKey: key, maxRetries: 3, timeout: 180_000 });

const LANGUAGES = {
  fr: 'French', rw: 'Kinyarwanda (as spoken in Rwanda)', sw: 'Swahili (Kiswahili, East Africa)',
  ar: 'Modern Standard Arabic', de: 'German', es: 'Spanish (neutral, understood across Latin America and Spain)',
  hi: 'Hindi', pt: 'Portuguese (neutral, understood in Mozambique, Angola and Brazil)', zh: 'Simplified Chinese',
};
const PH = /\{\{\s*\w+\s*\}\}/g;
const TAG = /<\/?strong>/g;
const same = (a, b) => JSON.stringify((a.match(PH) || []).sort()) === JSON.stringify((b.match(PH) || []).sort())
  && JSON.stringify((a.match(TAG) || []).sort()) === JSON.stringify((b.match(TAG) || []).sort());

const args = process.argv.slice(2);
const force = args.includes('--force');
const want = args.filter((a) => !a.startsWith('--'));
const langs = want.length ? want : Object.keys(LANGUAGES);
const keys = JSON.parse(fs.readFileSync(path.join(GEN, 'keys.json'), 'utf8'));

const TOOL = {
  name: 'save_translations',
  description: 'Save the translations, one per numbered string.',
  input_schema: {
    type: 'object',
    properties: { items: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, text: { type: 'string' } }, required: ['n', 'text'] } } },
    required: ['items'],
  },
};

async function translateBatch(lang, batch) {
  const list = batch.map((text, i) => `${i + 1}. ${text}`).join('\n');
  const system = `You translate the user interface of CropManager, a crop farm management app by Agricoders used by farmers, cooperatives and agronomists in Africa, into ${LANGUAGES[lang]}.
Rules:
- Keep placeholders such as {{name}} or {{count}} exactly as written, and keep <strong> tags where they are.
- Do not translate product or place names (CropManager, Agricoders, WhatsApp, SMS, QR, PDF, CSV, XLSX, NPK, Urea, DAP, TSP, MOP, CAN, ha, kg).
- Use short, natural wording a farmer understands. Buttons and labels stay short. Keep the same punctuation style and ellipses.
- Translate meaning, not word for word. Use the usual agricultural terms of the language.
- Reply only through the tool, with one entry per numbered string.`;
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 8000, system: system + `\nGive your answer only by calling the function ${TOOL.name}.`, tools: [TOOL],
    messages: [{ role: 'user', content: `Translate these ${batch.length} UI strings:\n\n${list}` }],
  });
  const block = msg.content.find((b) => b.type === 'tool_use');
  const out = {};
  for (const it of block?.input?.items || []) {
    const src = batch[it.n - 1];
    if (src && typeof it.text === 'string' && it.text.trim() && same(src, it.text)) out[src] = it.text.trim();
  }
  return out;
}

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

for (const lang of langs) {
  if (!LANGUAGES[lang]) { console.error('Unknown language', lang); continue; }
  const file = path.join(GEN, `${lang}.json`);
  const have = !force && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const dictFile = path.join(GEN, `dict_${lang}.json`);
  const hand = new Set(fs.existsSync(dictFile) ? JSON.parse(fs.readFileSync(dictFile, 'utf8')) : []);
  const todo = keys.filter((k) => !have[k] && !hand.has(k));
  console.log(`${lang}: ${todo.length} to translate (${Object.keys(have).length} done, ${hand.size} hand-written)`);
  const batches = [];
  for (let i = 0; i < todo.length; i += 45) batches.push(todo.slice(i, i + 45));
  let done = 0;
  await pool(batches, 4, async (batch) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const got = await translateBatch(lang, batch);
        Object.assign(have, got);
        // anything that failed validation is retried with the batch once more, then left in English
        const left = batch.filter((b) => !got[b]);
        if (!left.length || attempt === 2) break;
        batch = left;
      } catch (err) {
        if (attempt === 2) console.error(`  ${lang}: a batch failed (${err.status || ''} ${String(err.message).slice(0, 80)})`);
      }
    }
    done += 1;
    fs.writeFileSync(file, JSON.stringify(have, null, 1) + '\n');
    if (done % 5 === 0 || done === batches.length) console.log(`  ${lang}: ${done}/${batches.length} batches`);
  });
  fs.writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(have).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
  console.log(`${lang}: ${Object.keys(have).length} translated`);
}
