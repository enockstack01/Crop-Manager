/**
 * Checks how the offline assistant's text is read and filtered (src/ml/note.ts). No phone and no model needed:
 *
 *   node mobile/scripts/test-note.mjs
 */
import { parseNote, cleanText } from '../src/ml/note.ts';

let passed = 0;
let failures = 0;
const ok = (c, label, extra = '') => { if (c) { passed += 1; console.log(`  ok   ${label}`); } else { failures += 1; console.log(`  FAIL ${label} ${extra}`); } };

console.log('1. a well-formed answer');
const good = `OVERVIEW: Your maize has gray leaf spot, a fungal disease. It spreads in wet weather.
CAUSE: A fungus that likes humid, wet conditions.
STEPS:
- Remove and destroy badly affected leaves.
- Do not compost them.
- Rotate with a crop that is not a host.
PREVENT:
- Space plants so air can move.
- Use clean seed.
HELP: Ask your extension officer which registered product suits maize.`;
let n = parseNote(good, 'en');
ok(n.overview.startsWith('Your maize has gray leaf spot') && n.cause && n.steps.length === 3 && n.prevent.length === 2 && n.help, 'all five parts are read');
ok(n.lang === 'en', 'the language is kept');

console.log('2. chatter and markdown');
n = parseNote(`**OVERVIEW:** Bean mosaic virus is a viral disease.\n**CAUSE:** A virus spread by insects.\n**STEPS:**\n* Remove infected plants.\n* Control the insects.\n* Keep tools clean.\n**PREVENT:**\n* Use clean seed.\n* Weed the field.\n**HELP:** Ask the extension officer. Let me know if you'd like me to refine this further!\n--- I have focused only on the facts.`, 'en');
ok(!/let me know|---|focused/i.test(JSON.stringify(n)), 'closing chatter is removed');
ok(!JSON.stringify(n).includes('*'), 'markdown asterisks are removed');
ok(n.help === 'Ask the extension officer.', 'the real sentence is kept', n.help);

console.log('3. doses and products never get through');
n = parseNote(`OVERVIEW: Tomato late blight.\nCAUSE: A fungus.\nSTEPS:\n- Remove infected leaves.\n- Spray 2 kg of mancozeb per hectare.\n- Mix 50 ml in 15 litres of water.\n- Improve air flow.\nPREVENT:\n- Use copper sprays weekly.\n- Water at the base.\nHELP: Ask the extension officer.`, 'en');
ok(n.steps.join(' ') === 'Remove infected leaves. Improve air flow.', 'sentences with a dose or a product are dropped', JSON.stringify(n.steps));
ok(n.prevent.join(' ') === 'Water at the base.', 'products are dropped from prevention too', JSON.stringify(n.prevent));

console.log('3b. chemicals only with a pointer to the officer');
n = parseNote(`OVERVIEW: Rice blast.
CAUSE: A fungus.
STEPS:
- Spray the plants every week.
- Ask the extension officer which registered fungicide suits rice.
- Remove infected leaves.
PREVENT:
- Apply a protective product early.
- Use clean seed.
HELP: Ask the extension officer.`, 'en');
ok(n.steps.join(' ') === 'Ask the extension officer which registered fungicide suits rice. Remove infected leaves.', 'spraying advice is dropped, the pointer to the officer stays', JSON.stringify(n.steps));
ok(n.prevent.join(' ') === 'Use clean seed.', 'applying a product is dropped from prevention', JSON.stringify(n.prevent));

console.log('4. broken output');
n = parseNote(`OVERVIEW: Rice brown spot.\nCAUSE: recommendation_product_type_for_this_problem_type_of_disease_and_crop_type\nSTEPS:\n- Use clean seed.\n- Use clean seed.\n- Dry the field between watering.\nPREVENT:\n- Use clean seed.\nHELP:`, 'en');
ok(n.cause === '', 'a runaway string is not a sentence');
ok(n.steps.length === 2 && n.steps[0] === 'Use clean seed.', 'repeated steps appear once', JSON.stringify(n.steps));
ok(n.help === '', 'a missing part stays empty so the screen can leave it out');
n = parseNote('I am sorry, I cannot help with that.', 'en');
ok(!n.overview && !n.steps.length, 'text with no labels gives an empty note (the app then shows an error)');

console.log('5. French');
n = parseNote(`OVERVIEW: Le caféier a la rouille des feuilles, une maladie causée par un champignon.\nCAUSE: Un champignon qui aime l'humidité.\nSTEPS:\n- Enlevez et détruisez les feuilles très atteintes.\n- Utilisez de la bouillie bordelaise chaque semaine.\n- Aérez les plants.\nPREVENT:\n- Plantez des variétés résistantes.\nHELP: Demandez à l'agent de vulgarisation. N'hésitez pas à me demander.`, 'fr');
ok(n.overview.includes('rouille') && n.steps.join(' ') === 'Enlevez et détruisez les feuilles très atteintes. Aérez les plants.', 'accents are kept, the product is dropped', JSON.stringify(n.steps));
ok(n.help === "Demandez à l'agent de vulgarisation.", 'French chatter is removed', n.help);

console.log('6. length limits');
n = parseNote(`OVERVIEW: ${'Sentence about the crop. '.repeat(40)}\nSTEPS:\n- ${'step '.repeat(100)}.\nCAUSE: x.`, 'en');
ok(n.overview.length <= 320, 'the overview is capped', String(n.overview.length));

console.log('7. answers contain the answer only');
const clean = (t) => cleanText(t, 700);
ok(clean('Okay, here you go. Plant maize 75 cm between rows. Keep the field weeded.') === 'Plant maize 75 cm between rows. Keep the field weeded.', 'a greeting is dropped', clean('Okay, here you go. Plant maize 75 cm between rows. Keep the field weeded.'));
ok(clean('You asked how to store maize. Dry it well and keep it off the floor.') === 'Dry it well and keep it off the floor.', 'a sentence that restates the question is dropped');
ok(clean('Based on the information provided, rotate crops each season.') === '', 'a sentence that describes the information given is dropped');
ok(clean('Votre question porte sur le stockage. Séchez bien le maïs.') === 'Séchez bien le maïs.', 'the same in French');
ok(clean('Okra grows well in warm soil. High rows help drainage.') === 'Okra grows well in warm soil. High rows help drainage.', 'words that only start like okay or hi are kept');
ok(clean('Rotate crops. Beans are okay after maize.').includes('Beans are okay'), 'the word okay inside a real sentence is kept');

console.log('8. model control tokens');
const think = '<|channel>thought\nthinking out loud<channel|>Dry the maize well before storing it.<turn|>';
ok(clean(think) === 'Dry the maize well before storing it.', 'a thinking section and turn markers are removed', clean(think));
ok(clean('Keep the store clean.<end_of_turn>') === 'Keep the store clean.', 'the older end-of-turn marker is removed');
const tn = parseNote('<|turn>model\nOVERVIEW: Leaf rust on coffee.\nSTEPS:\n- Remove sick leaves.<turn|>', 'en');
ok(tn.overview === 'Leaf rust on coffee.' && tn.steps[0] === 'Remove sick leaves.', 'a note keeps its parts when markers surround it', JSON.stringify(tn));

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
