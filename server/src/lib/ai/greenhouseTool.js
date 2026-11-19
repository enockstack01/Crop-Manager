import { GreenhouseHouse, GreenhouseCrop, FruitCount } from '../../models/index.js';
import { buildLayout } from '../../controllers/greenhouseHouses.controller.js';
import { estimate } from '../greenhouse/revenue.js';

/*
 * A tool for the chat assistant: lets the farmer ask in plain words about the greenhouse ("how many fruit on row 3 plant 7 in House 1?",
 * "which plants have not been counted this week?", "which photos did not match?"). Read only, always the signed-in farmer's own data.
 */
const LABEL = { match: 'matches the photo', close: 'close to the photo', mismatch: 'does not match the photo', inconclusive: 'photo check not sure', not_checked: 'photo not checked', failed: 'photo check failed' };

const short = (p) => ({
  row: p.row_id, plant: p.plant_label, crop: p.crop_name, ...(p.label ? { name: p.label } : {}), ...(p.state && p.state !== 'active' ? { position: p.state === 'frozen' ? 'frozen (left alone on purpose)' : 'deactivated (uprooted)', reason: p.state_reason } : {}),
  latest: p.latest ? { date: p.latest.count_date, recorded: p.latest.recorded_count, photo_counted: p.latest.detected, result: LABEL[p.latest.status] || p.latest.status, counts_on_this_plant: p.latest.records, health: p.latest.health ? { status: p.latest.health.status, disease: p.latest.health.disease, sick_fruit: p.latest.health.sick_fruit, note: p.latest.health.message } : 'disease check not done' } : 'never counted',
});

export function greenhouseTool(userId) {
  const tools = [{
    name: 'greenhouse_info',
    description: 'Look up the farmer\'s greenhouses: their layout (rows and plants), the fruit counted on each plant, and whether the photo check agreed with the recorded number. Use it for any question about greenhouse plants, rows, fruit counts, photos that did not match, or plants not counted lately. Plants are named by row and plant number, for example row 3 plant 7.',
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['overview', 'plant', 'row', 'mismatches', 'not_counted', 'top_plants', 'diseased', 'harvest_value'], description: 'harvest_value: what the harvest could be worth, fruit counted, healthy fruit, the loss to disease and the projection for the whole greenhouse; overview: totals per greenhouse; plant: one plant with its history; row: every plant of one row; mismatches: plants whose photo did not match; not_counted: plants never counted or not counted for a number of days; top_plants: plants with the most or fewest fruit; diseased: plants whose last photo showed a disease (and which fruit)' },
        greenhouse: { type: 'string', description: 'Greenhouse name, for example House 1. Optional when the farmer has only one.' },
        row: { type: 'integer', description: 'Row number, from 1' },
        plant: { type: 'integer', description: 'Plant number in the row, from 1' },
        days: { type: 'integer', description: 'For not_counted: how many days without a count (default 7)' },
        order: { type: 'string', enum: ['most', 'fewest'], description: 'For top_plants' },
        limit: { type: 'integer', description: 'How many plants to list (1 to 30, default 10)' },
      },
      required: ['view'],
    },
  }];

  const handlers = {
    async greenhouse_info({ view, greenhouse, row, plant, days = 7, order = 'most', limit = 10 }) {
      const houses = await GreenhouseHouse.find({ user_id: userId }).sort({ name: 1 });
      if (!houses.length) return { note: 'The farmer has not set up a greenhouse layout yet (Greenhouse, then Layout).' };
      const n = Math.min(30, Math.max(1, Number(limit) || 10));
      if (view === 'harvest_value') {
        const [crops, counts] = await Promise.all([
          GreenhouseCrop.find({ user_id: userId }).lean(),
          FruitCount.find({ user_id: userId }).sort({ count_date: -1, created_at: -1 }).limit(20000).select('crop_id greenhouse row_id plant_label recorded_count fruit_size verification.health count_date').lean(),
        ]);
        const e = estimate({ houses: houses.map((x) => x.toObject()), counts, crops, greenhouse: greenhouse ? String(greenhouse).trim() : null });
        return {
          totals: e.totals, money: e.money, by_crop: e.by_crop.map((c) => ({ crop: c.name, fruit: c.fruit, healthy_fruit: c.fruit - c.sick_fruit - c.at_risk_fruit, lost_to_disease_percent: c.loss_share_pct, price_per_kg: c.price_per_kg, currency: c.currency, expected_value: c.net })),
          notes: e.notes, how: 'Expected value = counted fruit minus the fruit the photo check found sick and a share (20 per cent) of the other fruit on sick plants, at the price per kg. Plants not counted yet are projected from the counted ones.',
        };
      }
      const pick = greenhouse ? houses.filter((h) => h.name.toLowerCase() === String(greenhouse).trim().toLowerCase()) : houses.length === 1 ? houses : null;
      if (view === 'overview' || !pick) {
        if (view !== 'overview' && !pick) return { error: 'Which greenhouse?', greenhouses: houses.map((h) => h.name) };
        const out = [];
        for (const h of houses) {
          const l = await buildLayout(userId, h);
          out.push({ greenhouse: h.name, size: `${h.length_m} m by ${h.width_m} m`, rows: h.rows, plants_per_row: h.plants_per_row, ...l.summary });
        }
        return { greenhouses: out };
      }
      const h = pick[0];
      const l = await buildLayout(userId, h);
      if (view === 'plant') {
        const p = l.plants.find((x) => x.row === Number(row) && x.plant === Number(plant));
        if (!p) return { error: `There is no row ${row} plant ${plant} in ${h.name} (it has ${h.rows} rows of ${h.plants_per_row} plants).` };
        const history = await FruitCount.find({ user_id: userId, greenhouse: h.name, row_id: p.row_id, plant_label: p.plant_label }).sort({ count_date: -1 }).limit(10).lean();
        return { greenhouse: h.name, ...short(p), history: history.map((c) => ({ date: c.count_date, recorded: c.recorded_count, photo_counted: c.verification?.detected ?? null, result: LABEL[c.verification?.status] || 'photo not checked' })) };
      }
      if (view === 'row') {
        const ps = l.plants.filter((x) => x.row === Number(row));
        if (!ps.length) return { error: `There is no row ${row} in ${h.name} (it has ${h.rows} rows).` };
        const counted = ps.filter((x) => x.latest);
        const fruit = counted.reduce((s, x) => s + x.latest.recorded_count, 0);
        return { greenhouse: h.name, row: `R${row}`, plants: ps.length, counted: counted.length, fruit_on_counted_plants: fruit, average_per_counted_plant: counted.length ? Math.round((fruit / counted.length) * 10) / 10 : 0, plants_list: ps.slice(0, 60).map(short) };
      }
      if (view === 'mismatches') {
        const bad = l.plants.filter((x) => x.latest && x.latest.status === 'mismatch');
        return { greenhouse: h.name, plants_with_a_mismatch: bad.length, plants: bad.slice(0, n).map(short) };
      }
      if (view === 'not_counted') {
        const cut = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
        const old = l.plants.filter((x) => x.state !== 'inactive' && (!x.latest || x.latest.count_date < cut)); // a deactivated position is not expected to be counted
        return { greenhouse: h.name, days: Number(days), plants_not_counted_in_that_time: old.length, never_counted: old.filter((x) => !x.latest).length, examples: old.slice(0, n).map(short) };
      }
      if (view === 'diseased') {
        const bad = l.plants.filter((x) => x.latest?.health?.status === 'sick');
        return { greenhouse: h.name, plants_with_disease_signs: bad.length, plants: bad.slice(0, n).map(short) };
      }
      if (view === 'top_plants') {
        const ps = l.plants.filter((x) => x.latest).sort((a, b) => (order === 'fewest' ? a.latest.recorded_count - b.latest.recorded_count : b.latest.recorded_count - a.latest.recorded_count));
        return { greenhouse: h.name, order, plants: ps.slice(0, n).map(short) };
      }
      return { error: 'Unknown view' };
    },
  };
  return { tools, handlers };
}
