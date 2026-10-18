import { languageName } from './farmContext.js';

/**
 * Prompts and tool schemas for every CropManager AI feature. The tool schemas are the contract
 * with the web and mobile screens: the model must answer through them, so the screens always
 * receive the same shape.
 */

export const base = (lang) => `You are the CropManager assistant, built by Agricoders for farmers in Africa. You work like a friendly, practical agronomist who also understands farm finance.

Rules:
- Write every piece of text in ${languageName(lang)}. Use short sentences and plain words a farmer can act on. Keep crop, product and place names as people there say them.
- Base answers on the FARM DATA when it helps (crops, stages, weather season, stock, money). Never invent records. If something you need is missing, say what to record or check.
- Prices, doses and rules differ by country. Give general ranges and ask the farmer to follow the product label, local extension officers and national regulations. Name active ingredients or product types, not guaranteed brands.
- For anything risky (pesticides, veterinary-style treatments, spraying) include protective clothing, re-entry and pre-harvest intervals, and safe storage.
- You support, not replace, a local agronomist. When the problem is serious, spreading, or unclear, say clearly that an expert should look at it.
- Do not use markdown symbols such as ** or #. Plain sentences and short lists only.
- If asked who or what you are, say you are the CropManager assistant. Never name the AI model, its maker or the service behind you.`;

/** system blocks: stable instructions first, the farm snapshot last and cached for follow-up questions */
export const systemBlocks = (lang, contextText, extra = '') => [
  { type: 'text', text: base(lang) + (extra ? `\n\n${extra}` : '') },
  { type: 'text', text: contextText, cache_control: { type: 'ephemeral' } },
];

const str = (description) => ({ type: 'string', description });
const list = (description, item = { type: 'string' }) => ({ type: 'array', description, items: item });

export const DIAGNOSE_TOOL = {
  name: 'report_diagnosis',
  description: 'Report the most likely crop problem as a diagnosis-to-treatment report.',
  input_schema: {
    type: 'object',
    properties: {
      title: str('Name of the most likely problem, e.g. "Maize streak virus" or "Fall armyworm damage"'),
      problem_type: { type: 'string', enum: ['Disease', 'Pest', 'Nutrient deficiency', 'Weed', 'Weather or soil stress', 'Healthy', 'Unclear'] },
      confidence: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'How sure you are from the photo and notes' },
      severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
      cause: str('What is causing it and what favours it, in 2 to 4 sentences'),
      treatment: str('What to do now on the farm: removal, isolation, cultural steps, in order'),
      medication: str('Products to consider by active ingredient or type, with when to use them. Say "none needed" if nothing is required'),
      how_to_give: str('How to apply: dose range per area or water, timing, method, protective clothing, pre-harvest interval, re-entry time'),
      prevention: str('How to stop it coming back next season'),
      other_possibilities: list('Other things it could be, most likely first (at most 3)'),
      when_to_get_help: str('When to call an agronomist or extension officer, and what to show them'),
      follow_up_days: { type: 'integer', description: 'In how many days to check the crop again' },
      need_better_photo: { type: 'boolean', description: 'true when the photo or notes are too weak for a reliable answer' },
      photo_tips: str('What to photograph next time (empty if the photo was enough)'),
    },
    required: ['title', 'problem_type', 'confidence', 'severity', 'cause', 'treatment', 'medication', 'how_to_give', 'prevention', 'when_to_get_help'],
  },
};

export const INSIGHTS_TOOL = {
  name: 'report_insights',
  description: 'Report season insights and the next best actions for this farm.',
  input_schema: {
    type: 'object',
    properties: {
      headline: str('One sentence on how the farm is doing'),
      items: list('3 to 7 insights, most important first', {
        type: 'object',
        properties: {
          title: str('Short title'),
          detail: str('What the data shows and what to do, 1 to 3 sentences'),
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          area: { type: 'string', enum: ['Crops', 'Pests and disease', 'Inputs', 'Finance', 'Harvest', 'Records'] },
          module: { type: 'string', enum: ['crop-cycles', 'crop-scouting-records', 'inventory-items', 'expenses', 'sales', 'harvest-records', 'fertilizer-applications', 'irrigation-records', 'dashboard'], description: 'App screen where the farmer can act' },
        },
        required: ['title', 'detail', 'priority', 'area'],
      }),
      missing_records: list('Records the farmer should add to get better advice (at most 4)'),
    },
    required: ['headline', 'items'],
  },
};

export const ADVICE_TOPICS = {
  inputs: 'Which seed, fertiliser, chemicals and other inputs to buy for the coming season, how much, and how to save money. Use current stock from the FARM DATA to avoid buying what the farmer already has.',
  planting: 'Planting plan: best crop and variety choices for the field, timing, spacing, seed rate and field preparation.',
  fertiliser: 'Fertiliser plan: what nutrients the crop needs, product types, rates, timing and split applications, and organic options.',
  irrigation: 'Water plan: how often and how much to irrigate or when to rely on rain, how to save water and spot water stress.',
  protection: 'Pest, disease and weed prevention plan for the growing crops, with what to scout for and when.',
  harvest: 'Harvest and storage plan: signs of readiness, timing, handling, drying, storage and selling to get the best price.',
};

export const ADVICE_TOOL = {
  name: 'report_advice',
  description: 'Report a practical plan for the topic the farmer asked about.',
  input_schema: {
    type: 'object',
    properties: {
      headline: str('The plan in one sentence'),
      steps: list('Ordered steps the farmer can follow, each with timing and quantity where possible', {
        type: 'object',
        properties: { action: str('What to do'), when: str('When to do it'), detail: str('Amounts, method or reason') },
        required: ['action', 'when'],
      }),
      shopping_list: list('Inputs to buy with an approximate quantity (empty if none)', {
        type: 'object',
        properties: { item: str('Input name'), quantity: str('Approximate amount for this farm'), have_in_stock: str('What the farmer already has, or "none"') },
        required: ['item', 'quantity'],
      }),
      watch_outs: list('Risks and mistakes to avoid (at most 4)'),
      based_on: str('Which records you used from the farm data (and which you wished you had)'),
    },
    required: ['headline', 'steps', 'watch_outs'],
  },
};

export const SUMMARY_TOOL = {
  name: 'report_season_summary',
  description: 'Write a season summary a bank or lender can read.',
  input_schema: {
    type: 'object',
    properties: {
      title: str('Title, e.g. "Season summary: Farm name"'),
      overview: str('Who farms what, where and on how much land, 3 to 5 sentences'),
      production: str('What was planted, expected and harvested, with numbers from the data'),
      finances: str('Income, costs and result with numbers and currency from the data; say clearly if records are incomplete'),
      risks_and_controls: str('Main risks seen (pests, weather, stock, prices) and what the farmer did about them'),
      outlook: str('Plans and expected next season, and how finance would be used'),
      record_quality: str('How complete the records are and what would make them stronger for a lender'),
      highlights: list('3 to 5 short bullet facts a lender will want to see (numbers only from the data)'),
    },
    required: ['title', 'overview', 'production', 'finances', 'risks_and_controls', 'outlook', 'record_quality'],
  },
};

export const RECORD_TOOL = {
  name: 'propose_record',
  description: 'Turn what the farmer typed or said into one farm record. Use "none" when it is not a record.',
  input_schema: {
    type: 'object',
    properties: {
      resource: { type: 'string', enum: ['expenses', 'sales', 'harvest-records', 'none'] },
      summary: str('One sentence in the farmer\'s language saying what will be recorded, or why nothing can be recorded'),
      date: str('YYYY-MM-DD. Resolve "today" and "yesterday" from the date in the FARM DATA'),
      amount: { type: 'number', description: 'expenses: total money amount' },
      category: { type: 'string', enum: ['Seeds', 'Fertilizer', 'Pesticides', 'Labor', 'Irrigation', 'Machinery', 'Fuel', 'Transport', 'Storage', 'Equipment', 'Other'], description: 'expenses only' },
      description: str('expenses: what was bought or paid for'),
      supplier: str('expenses: who was paid'),
      currency: str('3-letter currency code if the farmer named one, otherwise empty'),
      crop: str('sales and harvest-records: crop name as written by the farmer'),
      quantity: { type: 'number', description: 'sales and harvest-records: amount' },
      unit: str('kg, bags, tonnes and so on'),
      unit_price: { type: 'number', description: 'sales: price per unit' },
      buyer: str('sales: who bought'),
      payment_status: { type: 'string', enum: ['Paid', 'Pending', 'Partially Paid'], description: 'sales only' },
      farm: str('Farm name if the farmer named one'),
      missing: list('Things the farmer should still tell us (for example the amount)'),
    },
    required: ['resource', 'summary'],
  },
};

export const mockFor = (feature) => MOCKS[feature];

const MOCKS = {
  diagnose: {
    title: 'Fall armyworm damage (sample answer)', problem_type: 'Pest', confidence: 'Medium', severity: 'High',
    cause: 'Young caterpillars feed inside the whorl and leave ragged holes and sawdust-like droppings. Warm dry spells and late planting favour them.',
    treatment: 'Scout 20 plants in a W pattern. Hand-pick egg masses and young larvae where the attack is small. Spray early morning or late evening, aiming into the whorl.',
    medication: 'A registered product with emamectin benzoate or spinetoram, or a Bt biopesticide for small larvae. Rotate active ingredients.',
    how_to_give: 'Follow the label dose per 15 litres. Wear gloves, mask and long sleeves. Observe the pre-harvest interval on the label. Keep children out of the field for the re-entry time.',
    prevention: 'Plant early and together with neighbours, scout weekly from emergence, rotate with legumes.',
    other_possibilities: ['Stem borer damage', 'Nutrient deficiency'], when_to_get_help: 'If more than 20 in 100 plants are damaged, ask the extension officer and show them a damaged plant.',
    follow_up_days: 5, need_better_photo: false, photo_tips: '',
  },
  insights: {
    headline: 'Sample insights: switch the assistant on to see advice based on your own records.',
    items: [{ title: 'Add this week\'s scouting', detail: 'No scouting record in the last 14 days. Walk each field and record pests, disease and weeds.', priority: 'Medium', area: 'Records', module: 'crop-scouting-records' }],
    missing_records: ['Expenses for this month'],
  },
  advice: {
    headline: 'Sample plan', steps: [{ action: 'Prepare the field', when: 'Two weeks before planting', detail: 'Clear weeds and loosen the soil.' }],
    shopping_list: [], watch_outs: ['Do not plant before the rains are steady.'], based_on: 'Mock answer.',
  },
  summary: {
    title: 'Season summary (sample)', overview: 'Sample overview.', production: 'Sample production.', finances: 'Sample finances.',
    risks_and_controls: 'Sample risks.', outlook: 'Sample outlook.', record_quality: 'Sample record quality.', highlights: ['Sample highlight'],
  },
  record: { resource: 'expenses', summary: 'Sample: record an expense of 50 for fertilizer.', date: new Date().toISOString().slice(0, 10), amount: 50, category: 'Fertilizer', description: 'Fertilizer', missing: [] },
  chat: 'This is a sample answer. Ask your administrator to switch the assistant on to chat about your farm.',
};
