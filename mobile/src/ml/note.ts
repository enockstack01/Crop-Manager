import { plainText } from '../lib/plainText.ts';
/*
 * Reading and checking what the small model writes. Pure functions with no phone code, so they can be tested on a computer
 * (mobile/scripts/test-note.mjs). Whatever the model says, anything that looks like a dose or a product is dropped, as is chatter.
 */
export type NoteLang = 'en' | 'fr';
export type Note = { lang: NoteLang; overview: string; cause: string; steps: string[]; prevent: string[]; help: string };

const LABELS = ['OVERVIEW', 'CAUSE', 'STEPS', 'PREVENT', 'HELP'];
// anything that looks like a dose or a product is dropped, however the small model got there
const DOSE = /\b\d+([.,]\d+)?\s?(g|kg|mg|ml|l|litres?|liters?|cc|%|ppm|tbsp|tsp|tablespoons?|teaspoons?|grammes?|grams?)\b/i;
const PRODUCT = /(mancozeb|dithane|ridomil|copper|cuivre|cypermethrin|cyperm[ée]thrine|lambda|chlorpyrifos|glyphosate|neem|metalaxyl|carbendazim|imidacloprid|emamectin|karate|roundup|bordeaux|sulph?ur|soufre)/i;
// sentences that talk about the request instead of answering it
const NARRATION = /^(okay|ok|sure|certainly|of course|hello|hi|bonjour|d'accord|bien s[ûu]r)\b|^(no (greeting|preamble|intro|introduction)|pas de (salutation|pr[ée]ambule)|answer only|reply with|start directly)|^(you (asked|want|are asking)|your question|the (user|question|farmer) (asked|is asking|wants)|as an ai|based on (the|your) (information|question|details|photo)|vous (avez demand|voulez savoir)|votre question|d'apr[èe]s (les|vos) (informations|d[ée]tails))/i;
const CHATTER = /(let me know|n'hésitez pas|i hope this|j'espère que|---|here is|voici|i have focused|je me suis concentr)/i;
// a list of product names is never complete, so any sentence about spraying or applying chemicals is dropped too,
// unless it sends the farmer to the extension officer or the product label (the only chemical advice the note may give)
const CHEMICAL = /(spray|pulv[ée]ris|bouillie|bordelaise|apply|applying|application|appliqu|treat with|traite[zr]? avec|fungicid|pesticid|insecticid|herbicid|chemical|chimique)/i;
const SEND_TO_EXPERT = /(extension officer|agent de vulgarisation|label|[ée]tiquette)/i;

// control tokens (end of turn, and the thinking sections of newer models) never belong in an answer
export const stripSpecial = (s: string) =>
  s.replace(/<\|channel>[\s\S]*?<channel\|>/g, ' ').replace(/<\|[^>\n]{1,30}>|<[^>\s|]{1,30}\|>|<(?:start|end)_of_turn>|<\/?(?:bos|eos)>/g, ' ');

export const cleanText = (s: string, max: number) => {
  const first = plainText(stripSpecial(s)).replace(/\s+/g, ' ').trim();
  // keep whole sentences that pass the filters, up to the length limit
  const kept: string[] = [];
  for (const raw of first.match(/[^.!?]+[.!?]*\s*/g) || [first]) {
    const sentence = raw.trim();
    if (!sentence || NARRATION.test(sentence) || CHATTER.test(sentence) || DOSE.test(sentence) || PRODUCT.test(sentence)) continue;
    if (CHEMICAL.test(sentence) && !SEND_TO_EXPERT.test(sentence)) continue;
    if (sentence.split(' ').some((w) => w.length > 28)) continue; // a runaway string, not a word
    kept.push(sentence);
  }
  return kept.join(' ').slice(0, max).trim();
};

/** Reads the five labelled parts; sections the model skipped stay empty. */
export function parseNote(text: string, lang: NoteLang): Note {
  const out = { overview: '', cause: '', steps: [] as string[], prevent: [] as string[], help: '' };
  let cur: string | null = null;
  for (const raw of stripSpecial(text).split(/\r?\n/)) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) continue;
    const m = line.match(new RegExp(`^(${LABELS.join('|')})\\s*:?\\s*(.*)$`, 'i'));
    if (m) {
      cur = m[1].toUpperCase();
      const rest = m[2].trim();
      if (cur === 'OVERVIEW') out.overview = rest;
      else if (cur === 'CAUSE') out.cause = rest;
      else if (cur === 'HELP') out.help = rest;
      else if (rest) (cur === 'STEPS' ? out.steps : out.prevent).push(rest.replace(/^[-*•]\s*/, ''));
      continue;
    }
    const item = line.replace(/^[-*•\d.)\s]+/, '').trim();
    if (cur === 'STEPS' && item) out.steps.push(item);
    else if (cur === 'PREVENT' && item) out.prevent.push(item);
    else if (cur === 'OVERVIEW') out.overview += ` ${line}`;
    else if (cur === 'CAUSE') out.cause += ` ${line}`;
    else if (cur === 'HELP') out.help += ` ${line}`;
  }
  const uniq = (a: string[], n: number, max: number) => [...new Set(a.map((x) => cleanText(x, max)).filter(Boolean))].slice(0, n);
  return {
    lang,
    overview: cleanText(out.overview, 320),
    cause: cleanText(out.cause, 260),
    steps: uniq(out.steps, 4, 220),
    prevent: uniq(out.prevent, 3, 200),
    help: cleanText(out.help, 240),
  };
}

