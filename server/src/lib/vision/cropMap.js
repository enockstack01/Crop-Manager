import { LABEL_CROPS } from './hfClient.js';

/*
 * Maps the crop name a farmer typed ("Maize", "beans ", "Irish potatoes", "ibigori") to one of the 49 crops the
 * disease classifier knows. Returns '' when there is no match, and the classifier then ranks all 229 classes.
 *
 * Add a name here when a farmer's crop does not match: the Crop records in the database show what people type.
 */
const SYNONYMS = {
  Maize: ['corn', 'mealie', 'mealies', 'sweet corn', 'green maize', 'ibigori', 'mahindi', 'mais', 'maïs'],
  Bean: ['beans', 'common bean', 'common beans', 'dry bean', 'dry beans', 'kidney bean', 'kidney beans', 'french bean', 'french beans', 'climbing bean', 'climbing beans', 'bush bean', 'ibishyimbo', 'maharage', 'haricot', 'haricots'],
  Potato: ['potatoes', 'irish potato', 'irish potatoes', 'white potato', 'ibirayi', 'viazi', 'pomme de terre', 'pommes de terre'],
  Tomato: ['tomatoes', 'inyanya', 'nyanya', 'tomate', 'tomates'],
  Cassava: ['manioc', 'tapioca', 'imyumbati', 'muhogo', 'cassava root', 'cassavas'],
  Rice: ['paddy', 'paddy rice', 'umuceri', 'mchele', 'riz'],
  Coffee: ['arabica', 'arabica coffee', 'robusta', 'robusta coffee', 'ikawa', 'kahawa', 'café'],
  Tea: ['tea leaf', 'tea leaves', 'icyayi', 'chai', 'thé'],
  Banana: ['bananas', 'plantain', 'plantains', 'cooking banana', 'ibitoki', 'ndizi', 'banane', 'bananes'],
  Soybean: ['soybeans', 'soya', 'soya bean', 'soya beans', 'soy', 'soja'],
  Groundnut: ['groundnuts', 'peanut', 'peanuts', 'ground nut', 'ground nuts', 'ubunyobwa', 'karanga', 'arachide', 'arachides'],
  Wheat: ['ingano', 'ngano', 'blé'],
  Sugarcane: ['sugar cane', 'sugar-cane', 'sugarcanes', 'ibisheke', 'miwa'],
  Cowpea: ['cowpeas', 'cow pea', 'cow peas', 'black-eyed pea', 'black eyed peas', 'niébé', 'kunde'],
  'Pigeon pea': ['pigeon peas', 'pigeonpea', 'pigeonpeas', 'pigeon-pea', 'congo pea', 'cajanus'],
  'Finger millet': ['millet', 'finger-millet', 'ragi', 'ulezi', 'uburo', 'eleusine'],
  'Bell pepper': ['bell peppers', 'sweet pepper', 'sweet peppers', 'capsicum', 'green pepper', 'poivron'],
  Chilli: ['chili', 'chilies', 'chillies', 'chilli pepper', 'chili pepper', 'hot pepper', 'hot peppers', 'pili pili', 'pilipili', 'piment'],
  Eggplant: ['eggplants', 'aubergine', 'aubergines', 'brinjal', 'biringanya', 'bilinganya'],
  Cabbage: ['cabbages', 'amashu', 'kabichi', 'chou'],
  Onion: ['onions', 'spring onion', 'spring onions', 'ibitunguru', 'vitunguu', 'oignon', 'oignons'],
  Garlic: ['garlics', 'tungurusumu', 'ail'],
  Ginger: ['tangawizi', 'gingembre'],
  Carrot: ['carrots', 'karoti', 'carotte'],
  Cucumber: ['cucumbers', 'concombre'],
  Lettuce: ['lettuces', 'laitue'],
  Mango: ['mangoes', 'mangos', 'umwembe', 'embe', 'mangue'],
  Papaya: ['papayas', 'pawpaw', 'paw paw', 'pawpaws', 'ipapayi', 'papai', 'papaye'],
  Citrus: ['lemon', 'lemons', 'lime', 'limes', 'tangerine', 'mandarin', 'grapefruit', 'citrus fruit', 'citron'],
  Orange: ['oranges', 'sweet orange', 'chungwa', 'orange tree'],
  Grape: ['grapes', 'raisin'],
  Grapevine: ['grape vine', 'grapevines', 'vigne'],
  Strawberry: ['strawberries', 'fraise', 'fraises'],
  Squash: ['squashes', 'pumpkin', 'pumpkins', 'butternut', 'butternut squash', 'courge', 'maboga'],
  Zucchini: ['courgette', 'courgettes', 'zucchinis', 'marrow'],
  Cotton: ['cottons', 'pamba', 'coton'],
  Tobacco: ['tobaccos', 'tumbaku', 'tabac'],
  Taro: ['cocoyam', 'cocoyams', 'colocasia', 'dasheen', 'amateke', 'magimbi'],
  Broccoli: ['brocoli'],
  Cauliflower: ['cauliflowers', 'chou-fleur', 'chou fleur'],
  Celery: ['celeries', 'céleri'],
  Basil: ['basils', 'basilic'],
  Apple: ['apples', 'pomme', 'pommes'],
  Peach: ['peaches', 'pêche'],
  Plum: ['plums', 'prune', 'prunes'],
  Cherry: ['cherries', 'cerise', 'cerises'],
  Blueberry: ['blueberries', 'myrtille', 'myrtilles'],
  Raspberry: ['raspberries', 'framboise', 'framboises'],
  Maple: ['maples', 'érable'],
};

/** look like a classifier crop by their last word but are a different plant, which the classifier does not cover */
const NOT_COVERED = /sweet potato|patate douce|ibijumba|viazi vitamu|cocoa|castor|sunflower|sorghum/;

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** every spelling we accept (normalised) -> label crop */
const LOOKUP = new Map();
for (const crop of LABEL_CROPS) LOOKUP.set(norm(crop), crop);
for (const [crop, names] of Object.entries(SYNONYMS)) {
  if (!LABEL_CROPS.has(crop)) throw new Error(`cropMap: "${crop}" is not a classifier crop`);
  for (const n of names) LOOKUP.set(norm(n), crop);
}

/** "tomatoes" -> "tomato", "berries"-style plurals: tried only when the plain name has no match */
function singular(s) {
  if (s.endsWith('ies') && s.length > 4) return `${s.slice(0, -3)}y`;
  if (/(oes|ses|xes|ches|shes)$/.test(s)) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

/**
 * The classifier crop for a name the farmer typed, or '' when it is not one of the 49 crops.
 * Tries the whole name first, then a trailing crop word ("hybrid maize" -> Maize, "Irish potatoes" -> Potato),
 * and never guesses from a word in the middle of an unrelated phrase.
 */
export function labelCropFor(name) {
  const n = norm(name);
  if (!n || NOT_COVERED.test(n)) return '';
  const direct = LOOKUP.get(n) || LOOKUP.get(singular(n));
  if (direct) return direct;
  const words = n.split(' ');
  // longest trailing run of words: "hybrid sweet corn" -> "sweet corn" -> "corn"
  for (let i = 1; i < words.length; i += 1) {
    const tail = words.slice(i).join(' ');
    const hit = LOOKUP.get(tail) || LOOKUP.get(singular(tail));
    if (hit) return hit;
  }
  return '';
}
