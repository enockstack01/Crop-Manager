/**
 * Makes AI text read like clean writing: no markdown, no dashes used as punctuation between words or sentences, no emoji or decorative symbols.
 *
 * The same rules are used in three places (server/src/lib/ai/plainText.js, client/src/lib/plainText.js, mobile/src/lib/plainText.ts) so an
 * answer is clean however it reaches the screen: the server cleans every reply before sending it, and each app cleans again what it shows
 * (older saved answers, and the offline assistant on the phone). Keep the three copies identical.
 *
 * What is removed or changed:
 *   markdown          ** bold **, __ bold __, *italic*, # headings, > quotes, `code`, ``` fences, --- rules, table pipes
 *   dashes            a long dash or a spaced hyphen between words or clauses becomes a comma ("rain — plant" -> "rain, plant");
 *                     a range of numbers becomes "80 to 100"; hyphens inside words (maize-bean, 5-7) and minus signs are kept
 *   lists             a bullet marker (-, *, a dot) is dropped and the item stays on its own line; numbered lists ("1.") are kept
 *   symbols           emoji, arrows, ticks and similar decoration
 */

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}\u{FE0E}\u{FE0F}\u{200D}]/gu;

function oneLine(line) {
  let s = line;
  // ranges of numbers written with a long dash: 80–100 -> 80 to 100
  s = s.replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2');
  // a long dash, or a spaced hyphen, joining words or clauses
  s = s.replace(/(\S)[ \t]*[–—―][ \t]*(\S)/g, (m, a, b) => (/[.,;:!?]/.test(a) ? `${a} ${b}` : `${a}, ${b}`));
  s = s.replace(/(\S)[ \t]+-{1,2}[ \t]+(\S)/g, (m, a, b) => {
    if (/\d/.test(a) && /\d/.test(b)) return m; // 10 - 5 is a sum
    return /[.,;:!?]/.test(a) ? `${a} ${b}` : `${a}, ${b}`;
  });
  s = s.replace(/(\w)--(\w)/g, '$1, $2');
  // a long dash left at the start or end of a line
  s = s.replace(/^[ \t]*[–—―]+[ \t]*/, '').replace(/[ \t]*[–—―]+[ \t]*$/, '');
  return s;
}

export function plainText(input) {
  if (typeof input !== 'string' || !input) return input;
  let s = input.replace(/\r\n?/g, '\n');
  s = s.replace(/```[a-zA-Z]*\n?/g, '').replace(/`/g, '');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '$1').replace(/__([^_\n]+?)__/g, '$1').replace(/\*\*|__/g, '');
  s = s.replace(/(^|[\s(])\*([^\s*][^*\n]*?)\*(?=[\s).,;:!?]|$)/g, '$1$2');
  // arrows between ideas read as a comma (done before the other symbols are removed)
  s = s.replace(/[ 	]*(?:-->|->|=>|→|⇒|➜|➔)[ 	]*/g, ', ');
  s = s.replace(EMOJI, '');
  const lines = s.split('\n').map((raw) => {
    let line = raw;
    if (/^[ \t]*([-*_=~])\1{2,}[ \t]*$/.test(line)) return null; // a rule line: dropped
    line = line.replace(/^[ \t]*#{1,6}[ \t]*/, '').replace(/^[ \t]*>[ \t]?/, '');
    line = line.replace(/^[ \t]*(?:[-*•·▪◦‣⁃●○][ \t]+)/, ''); // bullet marker: the item stays on its own line
    if (/^[ \t]*\|.*\|[ \t]*$/.test(line)) line = line.replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/g, '').replace(/[ \t]*\|[ \t]*/g, ', ');
    line = oneLine(line);
    line = line.replace(/\*/g, '');
    return line.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([,.;:!?])/g, '$1').replace(/,{2,}/g, ',').replace(/,\s*([.!?])/g, '$1').trim();
  }).filter((l) => l !== null);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Cleans every piece of text inside an answer (strings in objects and lists); numbers, flags and ids are left alone. */
export function plainDeep(value) {
  if (typeof value === 'string') return plainText(value);
  if (Array.isArray(value)) return value.map(plainDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainDeep(v)]));
  return value;
}
