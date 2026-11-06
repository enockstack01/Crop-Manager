import { Directory, File, Paths } from 'expo-file-system';
import { initLlama, LlamaContext } from 'llama.rn';
import { familyAdviceIn } from './advice';
import { labelNames } from './crops';
import { cleanText, parseNote, type Note, type NoteLang } from './note';

export { parseNote };
export type { Note, NoteLang };

/*
 * The offline assistant: a small language model (Gemma 3 1B, 4-bit, 769 MB) that runs on the phone through llama.cpp and writes
 * a short treatment note from what the photo model found. It plays the role online assistant plays when there is signal, much more
 * modestly: it is small, so the note is short, always English or French, grounded in the stored advice, and can still be wrong.
 *
 * The model is too big to ship inside the app, so the farmer downloads it once (resumable, in 8 MB pieces) and it lives in the
 * app's own storage. Gemma is provided under the Gemma Terms of Use (https://ai.google.dev/gemma/terms).
 */

export const MODEL = {
  file: 'gemma-3-1b-it-Q4_K_M.gguf',
  url: 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf',
  bytes: 806_058_240,
  sha256: '8ccc5cd1f1b3602548715ae25a66ed73fd5dc68a210412eea643eb20eb75a135', // published checksum, for reference
};
// small pieces and a time limit for each: on a slow or dropping connection a request can hang for ever without failing, which would leave the
// download stuck. 2 MB in 120 s still works on a connection of about 17 KB/s.
const CHUNK = 2 * 1024 * 1024;
const CHUNK_TIMEOUT_MS = 120_000;

/** Languages the small model writes well in (checked by hand). Every other language gets the note in English. */
export const NOTE_LANGS = ['en', 'fr'] as const;
export const noteLangFor = (appLang: string): NoteLang => (appLang === 'fr' ? 'fr' : 'en');

/* ------------------------------------------------------------------ the model file */

const dir = () => new Directory(Paths.document, 'llm');
const finalFile = () => new File(dir(), MODEL.file);
const partFile = () => new File(dir(), `${MODEL.file}.part`);

export type ModelState = { state: 'ready' | 'partial' | 'none'; have: number; total: number };

export function modelStatus(): ModelState {
  const f = finalFile();
  if (f.exists && f.size === MODEL.bytes) return { state: 'ready', have: MODEL.bytes, total: MODEL.bytes };
  const p = partFile();
  if (p.exists && p.size > 0) return { state: 'partial', have: p.size, total: MODEL.bytes };
  return { state: 'none', have: 0, total: MODEL.bytes };
}

export const modelReady = () => modelStatus().state === 'ready';

/**
 * Downloads (or continues downloading) the model. Pieces of 8 MB are requested with HTTP Range and appended to a partial
 * file, so a dropped connection or a closed app loses at most one piece; calling this again picks up where it stopped.
 */
export async function downloadModel({ onProgress, signal }: { onProgress?: (have: number, total: number) => void; signal?: AbortSignal } = {}): Promise<void> {
  if (modelReady()) return;
  const d = dir();
  if (!d.exists) d.create({ idempotent: true, intermediates: true });
  const part = partFile();
  if (!part.exists) part.create();
  let have = part.size;
  if (have > MODEL.bytes) { part.delete(); part.create(); have = 0; }
  onProgress?.(have, MODEL.bytes);

  while (have < MODEL.bytes) {
    if (signal?.aborted) throw new Error('cancelled');
    const end = Math.min(have + CHUNK - 1, MODEL.bytes - 1);
    const want = end - have + 1;
    let bytes: Uint8Array | null = null;
    for (let attempt = 0; attempt < 5 && !bytes; attempt += 1) {
      try {
        // this piece gets its own timer; the person's Stop (signal) also ends it
        const piece = new AbortController();
        const onStop = () => piece.abort();
        signal?.addEventListener('abort', onStop);
        const timer = setTimeout(() => piece.abort(), CHUNK_TIMEOUT_MS);
        let buf: Uint8Array;
        try {
          const res = await fetch(MODEL.url, { headers: { Range: `bytes=${have}-${end}` }, signal: piece.signal });
          if (res.status !== 206) throw new Error(`the server answered ${res.status}`); // a 200 would be the whole file: not what we asked for
          buf = new Uint8Array(await res.arrayBuffer());
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onStop);
        }
        if (buf.length !== want) throw new Error('a piece arrived incomplete');
        bytes = buf;
      } catch (e: any) {
        if (signal?.aborted) throw new Error('cancelled');
        if (attempt === 4) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); // wait a little longer each time
      }
    }
    const h = part.open();
    try {
      h.offset = have;
      h.writeBytes(bytes!);
    } finally {
      h.close();
    }
    have += want;
    onProgress?.(have, MODEL.bytes);
  }

  if (part.size !== MODEL.bytes) throw new Error('The download is not complete. Try again.');
  const f = finalFile();
  if (f.exists) f.delete();
  part.rename(MODEL.file);
}

export function deleteModel() {
  releaseModel();
  for (const f of [finalFile(), partFile()]) if (f.exists) f.delete();
}

/* ------------------------------------------------------------------ running it */

let ctx: LlamaContext | null = null;
let loading: Promise<LlamaContext> | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;
const KEEP_MS = 120_000;

async function context(): Promise<LlamaContext> {
  if (ctx) return ctx;
  if (!modelReady()) throw new Error('The offline assistant is not downloaded yet.');
  loading ||= initLlama({
    model: finalFile().uri.replace(/^file:\/\//, ''),
    n_ctx: 2048,
    n_gpu_layers: 0, // the processor only: the most reliable choice across phones
    use_mlock: false,
  })
    .then((c) => { ctx = c; return c; })
    .finally(() => { loading = null; });
  return loading;
}

/** Frees the model's memory (about 1 GB) a couple of minutes after the last note. */
function scheduleRelease() {
  if (idle) clearTimeout(idle);
  idle = setTimeout(releaseModel, KEEP_MS);
}
export function releaseModel() {
  if (idle) clearTimeout(idle);
  idle = null;
  const c = ctx;
  ctx = null;
  c?.release().catch(() => {});
}
export async function stopWriting() {
  await ctx?.stopCompletion().catch(() => {});
}

/* ------------------------------------------------------------------ the note */

export type NoteInput = {
  label: string; // the photo model's top class key
  others: string[]; // the next matches, as readable text with percentages
  confident: boolean;
  family: string;
  notes?: string;
  lang: NoteLang;
};

const EN = {
  intro: (L: string) => `You help smallholder farmers in Africa. Write a short note about the plant problem below, in ${L}, in simple words.`,
  facts: 'FACTS',
  crop: 'Crop', problem: (d: string, p: string, f: string) => `Most likely problem: ${d} (on the ${p}), type: ${f}`,
  sure: (c: boolean, others: string[]) => `The phone's photo check was ${c ? 'fairly sure' : 'NOT sure'}.${others.length ? ` Other possible matches: ${others.join('; ')}.` : ''}`,
  notes: (n: string) => `Farmer's notes: ${n}`,
  advice: 'Approved advice for this type of problem:',
  format: (c: boolean) => `Write exactly these five parts, each starting with its label in capital letters, in this order:
OVERVIEW: one or two sentences saying what the problem is${c ? '' : ' and that the match is uncertain'}.
CAUSE: one sentence on what causes it.
STEPS:
- three short steps, taken ONLY from the approved advice above, said simply for this crop
PREVENT:
- two short ways to prevent it next time, also taken only from the approved advice
HELP: one sentence on when to ask the local extension officer.`,
  rules: 'Rules: use only the facts and the approved advice; do not add other farming tips. Never give doses, amounts, spray dates, or product or brand names; for any chemical, say to ask the extension officer which registered product suits this crop and to follow the label. Do not invent facts about the farm.',
};
const FR = {
  intro: () => "Tu aides les petits agriculteurs en Afrique. Écris en français, avec des mots simples, une courte note sur le problème de plante ci-dessous.",
  facts: 'FAITS',
  crop: 'Culture', problem: (d: string, p: string, f: string) => `Problème le plus probable : ${d} (sur ${p}), type : ${f}`,
  sure: (c: boolean, others: string[]) => `La vérification par photo était ${c ? 'assez sûre' : "PAS sûre"}.${others.length ? ` Autres correspondances possibles : ${others.join(' ; ')}.` : ''}`,
  notes: (n: string) => `Notes de l'agriculteur : ${n}`,
  advice: 'Conseils approuvés pour ce type de problème :',
  format: (c: boolean) => `Écris exactement ces cinq parties, chacune commençant par son étiquette en MAJUSCULES, dans cet ordre :
OVERVIEW: une ou deux phrases qui disent quel est le problème${c ? '' : " et que la correspondance est incertaine"}.
CAUSE: une phrase sur la cause.
STEPS:
- trois courtes actions, tirées UNIQUEMENT des conseils approuvés ci-dessus, dites simplement pour cette culture
PREVENT:
- deux courtes façons de l'éviter la prochaine fois, aussi tirées uniquement des conseils approuvés
HELP: une phrase sur quand demander l'agent de vulgarisation.`,
  rules: "Règles : n'utilise que les faits et les conseils approuvés ; n'ajoute pas d'autres conseils agricoles. Ne donne jamais de doses, de quantités, de dates de traitement ni de noms de produits ; pour un produit chimique, dis de demander à l'agent de vulgarisation quel produit homologué convient à cette culture et de suivre l'étiquette. N'invente rien sur l'exploitation. Réponds uniquement en français.",
};

export function buildPrompt(i: NoteInput): string {
  const T = i.lang === 'fr' ? FR : EN;
  const n = labelNames(i.label, i.lang);
  const adv = familyAdviceIn(i.family, i.lang);
  const advice = [...adv.act, ...adv.prevent];
  const facts = [
    `${T.crop}: ${n.crop}`,
    T.problem(n.disease, n.part, i.family),
    T.sure(i.confident, i.others),
    i.notes ? T.notes(i.notes.slice(0, 300)) : '',
    `${T.advice}\n${advice.map((a, k) => `${k + 1}. ${a}`).join('\n')}`,
  ].filter(Boolean).join('\n');
  return `${T.intro('English')}\n\n${T.facts}\n${facts}\n\n${T.format(i.confident)}\n\n${T.rules}`;
}

/** Writes the note on the phone. Throws if the model is missing, cannot be loaded (too little memory) or writes nothing usable. */
export async function writeNote(input: NoteInput, onProgress?: (chars: number) => void): Promise<Note> {
  const c = await context();
  try {
    let chars = 0;
    const res = await c.completion(
      {
        messages: [{ role: 'user', content: buildPrompt(input) }],
        n_predict: 380,
        temperature: 0.2,
        top_k: 30,
        top_p: 0.9,
        penalty_repeat: 1.1,
        stop: ['<end_of_turn>'],
      },
      (d) => { chars += (d.token || '').length; onProgress?.(chars); },
    );
    const note = parseNote(res.text || '', input.lang);
    if (!note.overview || !note.steps.length) throw new Error('The note could not be written. Try again.');
    return note;
  } finally {
    scheduleRelease();
  }
}

/* ------------------------------------------------------------------ questions */

export type Turn = { role: 'user' | 'assistant'; content: string };

const ASK = {
  en: {
    system: `You are the offline farm helper of CropManager, for smallholder farmers in Africa. Answer in English, in at most five short sentences, in simple words. Give only basic, well-known farm practice (crop care, planting, spacing, soil, water, storage, hygiene). Never give doses, mixing amounts, spray dates, or product or brand names. For pests, diseases or chemicals, say what to look for and that the local extension officer knows which registered product suits the crop and the label must be followed. If you are not sure, say so and send the farmer to an extension officer. Do not invent facts about the farmer's farm.`,
    unsafe: 'I cannot answer that safely without internet. Please ask a local extension officer, or try again when you are online.',
  },
  fr: {
    system: `Tu es l'assistant agricole hors ligne de CropManager, pour les petits agriculteurs en Afrique. Réponds en français, en cinq phrases courtes au plus, avec des mots simples. Donne seulement des pratiques agricoles de base bien connues (soins des cultures, semis, espacement, sol, eau, stockage, hygiène). Ne donne jamais de doses, de quantités de mélange, de dates de traitement ni de noms de produits. Pour les ravageurs, les maladies ou les produits chimiques, dis quoi observer et que l'agent de vulgarisation sait quel produit homologué convient à la culture et qu'il faut suivre l'étiquette. Si tu n'es pas sûr, dis-le et envoie l'agriculteur voir un agent de vulgarisation. N'invente rien sur l'exploitation de l'agriculteur.`,
    unsafe: "Je ne peux pas répondre à cela en toute sécurité sans internet. Demandez à un agent de vulgarisation, ou réessayez quand vous êtes en ligne.",
  },
};

/** Answers a farming question on the phone. The answer is filtered the same way as the notes (no doses, no products, no chatter). */
export async function askOffline(history: Turn[], question: string, lang: NoteLang, onProgress?: (chars: number) => void): Promise<string> {
  const c = await context();
  const T = ASK[lang] || ASK.en;
  try {
    let chars = 0;
    const res = await c.completion(
      {
        messages: [{ role: 'system', content: T.system }, ...history.slice(-6).map((h) => ({ role: h.role, content: h.content.slice(0, 600) })), { role: 'user', content: question.slice(0, 500) }],
        n_predict: 300,
        temperature: 0.3,
        top_k: 30,
        top_p: 0.9,
        penalty_repeat: 1.1,
        stop: ['<end_of_turn>'],
      },
      (d) => { chars += (d.token || '').length; onProgress?.(chars); },
    );
    const text = cleanText(res.text || '', 700);
    return text.length >= 12 ? text : T.unsafe;
  } finally {
    scheduleRelease();
  }
}
