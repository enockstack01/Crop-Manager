import { positionsOf, keyOf } from './layout.js';

/*
 * What the harvest could be worth. From the latest count of every plant, the health check of that count and a price per kilogram:
 *
 *   gross          everything counted, sold as it is (fruit x weight x price)
 *   sick fruit     fruit the photo check marked as diseased. When only some of the fruit were checked (the check looks at up to 20), the
 *                  share found sick is applied to the whole count.
 *   at risk        on a plant the check calls sick, a share of the remaining fruit may go the same way (`risk`, 20 per cent unless set)
 *   net (expected) gross without the sick fruit and the fruit at risk
 *   best / worst   best loses only the sick fruit; worst loses every fruit on every sick plant
 *   projected      plants not counted yet are given the average of the counted plants of the main crop of that greenhouse, with the same loss
 *
 * It is an estimate, not a promise: it is as good as the counts, the weights and the prices behind it.
 */
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
export const DEFAULT_RISK = 0.2;

const bucket = () => ({
  plants: 0, fruit: 0, sick_fruit: 0, at_risk_fruit: 0, worst_loss_fruit: 0, kg: 0, kg_net: 0, kg_best: 0, kg_worst: 0,
  gross: 0, net: 0, net_best: 0, net_worst: 0,
});

function addPlant(b, p) {
  b.plants += 1;
  b.fruit += p.fruit;
  b.sick_fruit += p.sick;
  b.at_risk_fruit += p.atRisk;
  b.worst_loss_fruit += p.worstLoss;
  const kgOf = (n) => (n * p.kgEach);
  b.kg += kgOf(p.fruit);
  b.kg_best += kgOf(p.fruit - p.sick);
  b.kg_net += kgOf(p.fruit - p.sick - p.atRisk);
  b.kg_worst += kgOf(p.fruit - p.worstLoss);
  if (p.price != null) {
    const m = (n) => kgOf(n) * p.price;
    b.gross += m(p.fruit);
    b.net_best += m(p.fruit - p.sick);
    b.net += m(p.fruit - p.sick - p.atRisk);
    b.net_worst += m(p.fruit - p.worstLoss);
  }
}

const finish = (b) => ({
  ...b,
  kg: r1(b.kg), kg_net: r1(b.kg_net), kg_best: r1(b.kg_best), kg_worst: r1(b.kg_worst),
  gross: r2(b.gross), net: r2(b.net), net_best: r2(b.net_best), net_worst: r2(b.net_worst),
  loss: r2(b.gross - b.net),
  loss_share_pct: b.fruit ? r1(((b.sick_fruit + b.at_risk_fruit) / b.fruit) * 100) : 0,
});

/** The sick fruit of one count: the share of the checked fruit found sick, applied to the whole count. */
export function sickFruitOf(count) {
  const h = count?.verification?.health;
  if (!h || h.status !== 'sick') return { plantSick: false, sick: 0, checked: !!(h && h.status && h.status !== 'not_checked') };
  const fruit = count.recorded_count || 0;
  const sickN = h.sick_fruit || 0;
  const checked = h.checked_fruit || 0;
  const est = checked > 0 ? Math.round((sickN / checked) * fruit) : sickN;
  return { plantSick: true, sick: Math.min(fruit, est), checked: true };
}

/**
 * @param houses  the farmer's greenhouses (documents or plain objects with positions)
 * @param counts  fruit counts, newest first
 * @param crops   the farmer's crops (with price_per_kg, fruit_weight_g, currency)
 */
export function estimate({ houses, counts, crops, risk = DEFAULT_RISK, greenhouse = null, today = new Date().toISOString().slice(0, 10), staleDays = 7 }) {
  const staleBefore = new Date(Date.parse(`${today}T00:00:00Z`) - staleDays * 86400000).toISOString().slice(0, 10);
  const sickList = [];
  const cropById = new Map(crops.map((c) => [String(c._id), c]));
  const rk = Math.min(1, Math.max(0, Number.isFinite(Number(risk)) ? Number(risk) : DEFAULT_RISK));
  const list = greenhouse ? houses.filter((h) => h.name === greenhouse) : houses;

  const total = bucket();
  const byCrop = new Map();
  const byCurrency = new Map();
  const byHouse = [];
  const missingPrice = new Set();
  let uncheckedPlants = 0;
  let partialSize = 0;

  const cur = (c) => {
    const k = c.currency || 'USD';
    if (!byCurrency.has(k)) byCurrency.set(k, { ...bucket(), projected_gross: 0, projected_net: 0 });
    return byCurrency.get(k);
  };

  for (const h of list) {
    const latest = new Map();
    for (const c of counts) {
      if (c.greenhouse !== h.name) continue;
      const k = keyOf(c.row_id, c.plant_label);
      if (!latest.has(k)) latest.set(k, c);
    }
    const hb = bucket();
    const cropPlants = new Map();
    let active = 0;
    let counted = 0;
    let sickPlants = 0;
    let stale = 0;
    let frozen = 0;
    for (const pos of positionsOf(h)) {
      const key = keyOf(pos.row_id, pos.plant_label);
      const st = (h.positions && h.positions[key]?.state) || 'active';
      if (st === 'inactive') continue;
      active += 1;
      if (st === 'frozen') frozen += 1;
      const c = latest.get(key);
      if (!c) continue;
      const crop = cropById.get(String(c.crop_id));
      if (!crop) continue;
      counted += 1;
      const s = sickFruitOf(c);
      if (!s.checked) uncheckedPlants += 1;
      if (c.fruit_size && c.fruit_size !== 'all') partialSize += 1;
      const fruit = c.recorded_count || 0;
      const price = crop.price_per_kg > 0 ? crop.price_per_kg : null;
      if (price == null) missingPrice.add(crop.name);
      const p = {
        fruit, sick: s.sick, atRisk: s.plantSick ? Math.round((fruit - s.sick) * rk) : 0, worstLoss: s.plantSick ? fruit : 0,
        kgEach: (crop.fruit_weight_g || 0) / 1000, price,
      };
      if (s.plantSick) {
        sickPlants += 1;
        sickList.push({ greenhouse: h.name, row_id: pos.row_id, plant_label: pos.plant_label, crop: crop.name, fruit, sick_fruit: s.sick, disease: c.verification?.health?.plant?.disease || null, date: c.count_date, state: st });
      }
      if (c.count_date < staleBefore) stale += 1;
      addPlant(hb, p);
      addPlant(total, p);
      const cb = byCrop.get(String(crop._id)) || { crop_id: String(crop._id), name: crop.name, price_per_kg: price, fruit_weight_g: crop.fruit_weight_g || 0, currency: crop.currency || 'USD', ...bucket() };
      addPlant(cb, p);
      byCrop.set(String(crop._id), cb);
      addPlant(cur(crop), p);
      const cp = cropPlants.get(String(crop._id)) || { crop, plants: 0, fruit: 0, net: 0 };
      cp.plants += 1;
      cp.fruit += fruit;
      cp.net += fruit - p.sick - p.atRisk;
      cropPlants.set(String(crop._id), cp);
    }

    // plants not counted yet: the main crop's average, with the same loss as the counted plants of that crop
    let projected = null;
    const uncounted = active - counted;
    if (uncounted > 0 && cropPlants.size) {
      const main = [...cropPlants.values()].sort((a, b) => b.plants - a.plants)[0];
      const avg = main.fruit / main.plants;
      const keep = main.fruit ? main.net / main.fruit : 1;
      const kgEach = (main.crop.fruit_weight_g || 0) / 1000;
      const price = main.crop.price_per_kg > 0 ? main.crop.price_per_kg : null;
      const fruit = Math.round(uncounted * avg);
      projected = {
        plants: uncounted, crop: main.crop.name, avg_per_plant: r1(avg), fruit, fruit_net: Math.round(fruit * keep),
        kg: r1(fruit * kgEach), kg_net: r1(fruit * keep * kgEach),
        gross: price == null ? 0 : r2(fruit * kgEach * price), net: price == null ? 0 : r2(fruit * keep * kgEach * price),
      };
      const cc = cur(main.crop);
      cc.projected_gross += projected.gross;
      cc.projected_net += projected.net;
    }
    byHouse.push({
      id: String(h._id), name: h.name, positions: positionsOf(h).length, active_positions: active, counted_plants: counted, uncounted_plants: uncounted,
      sick_plants: sickPlants, frozen_plants: frozen, stale_plants: stale, ...finish(hb), projected,
    });
  }

  const money = [...byCurrency.entries()].map(([currency, b]) => {
    const f = finish(b);
    return {
      currency, gross: f.gross, loss: f.loss, net: f.net, net_best: f.net_best, net_worst: f.net_worst,
      projected_gross: r2(b.projected_gross), projected_net: r2(b.projected_net),
      whole_net: r2(f.net + b.projected_net), whole_gross: r2(f.gross + b.projected_gross),
    };
  });
  const projFruit = byHouse.reduce((n, h) => n + (h.projected?.fruit || 0), 0);
  const projFruitNet = byHouse.reduce((n, h) => n + (h.projected?.fruit_net || 0), 0);
  const projKgNet = byHouse.reduce((n, h) => n + (h.projected?.kg_net || 0), 0);
  const t = finish(total);
  const notes = [];
  if (missingPrice.size) notes.push(`No price per kg for ${[...missingPrice].join(', ')}: the money for them is left out.`);
  if (uncheckedPlants) notes.push(`${uncheckedPlants} counted ${uncheckedPlants === 1 ? 'plant has' : 'plants have'} no health check, so their fruit are taken as healthy.`);
  if (partialSize) notes.push(`${partialSize} count${partialSize === 1 ? ' is' : 's are'} for one fruit size only, so the plant may carry more fruit than counted.`);
  return {
    risk: rk,
    sick_list: sickList.sort((a, b) => b.sick_fruit - a.sick_fruit || b.fruit - a.fruit),
    totals: {
      ...t, counted_plants: t.plants, active_plants: byHouse.reduce((n, h) => n + h.active_positions, 0),
      sick_plants: byHouse.reduce((n, h) => n + h.sick_plants, 0), unchecked_plants: uncheckedPlants,
      healthy_fruit: total.fruit - total.sick_fruit - total.at_risk_fruit,
      projected_fruit: projFruit, whole_fruit: total.fruit + projFruit, whole_fruit_net: total.fruit - total.sick_fruit - total.at_risk_fruit + projFruitNet,
      whole_kg_net: r1(total.kg_net + projKgNet),
    },
    money,
    by_crop: [...byCrop.values()].map(finish).sort((a, b) => b.gross - a.gross || b.fruit - a.fruit),
    by_house: byHouse,
    notes,
    method: 'Gross is every counted fruit sold as it is. Sick fruit and the fruit at risk on sick plants are taken off to give the expected value; plants not counted yet are filled in from the average of the counted ones.',
    generated_at: new Date().toISOString(),
  };
}

/** The same estimate as it stood at the end of each of the last `weeks` weeks: only counts made by then are used, so the line shows whether disease loss is growing. */
export function history({ houses, counts, crops, risk = DEFAULT_RISK, greenhouse = null, weeks = 12, today = new Date().toISOString().slice(0, 10) }) {
  const t = Date.parse(`${today}T00:00:00Z`);
  const monday = (ms) => { const d = new Date(ms); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = monday(t - i * 7 * 86400000);
    const end = i === 0 ? today : new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
    const e = estimate({ houses, counts: counts.filter((c) => c.count_date <= end), crops, risk, greenhouse, today: end });
    const T = e.totals;
    out.push({
      week: start, as_of: end, counted_plants: T.counted_plants, fruit: T.fruit, healthy_fruit: T.healthy_fruit, sick_fruit: T.sick_fruit, at_risk_fruit: T.at_risk_fruit,
      loss_share_pct: T.loss_share_pct, sick_plants: T.sick_plants, kg: T.kg, kg_net: T.kg_net,
      money: e.money.map((m) => ({ currency: m.currency, gross: m.gross, net: m.net, loss: m.loss })),
    });
  }
  return out;
}
