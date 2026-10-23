import { Farm, Field, CropCycle, Crop } from '../models/index.js';

/*
 * Weather for a farm. OpenWeatherMap when OPENWEATHER_API_KEY works; otherwise (no key, or the key is not
 * active yet) the free Open-Meteo service, so the page never goes blank. Both are turned into one shape:
 *   { provider, location, current, hourly[], daily[], rain_past_7d_mm }
 * and the farm-specific advice and the water balance are worked out from that shape.
 */
const OWM = 'https://api.openweathermap.org';
const key = () => process.env.OPENWEATHER_API_KEY || '';
const TTL = 10 * 60 * 1000;
const cache = new Map();
const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

async function getJson(url, ms = 9000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw Object.assign(new Error(`weather ${res.status}`), { status: res.status });
  return res.json();
}

/** icon group used by the pages */
const kindFromOwm = (id) => (id >= 200 && id < 300 ? 'storm' : id < 400 ? 'drizzle' : id < 600 ? 'rain' : id < 700 ? 'snow' : id < 800 ? 'fog' : id === 800 ? 'clear' : id <= 802 ? 'partly' : 'clouds');
const kindFromWmo = (c) => (c === 0 ? 'clear' : c <= 2 ? 'partly' : c === 3 ? 'clouds' : c <= 48 ? 'fog' : c <= 57 ? 'drizzle' : c <= 67 ? 'rain' : c <= 77 ? 'snow' : c <= 82 ? 'rain' : c <= 86 ? 'snow' : 'storm');
const WMO = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' };

/** Reference evapotranspiration (mm/day) from the temperature range when the service does not give one (Hargreaves). */
const et0From = (tmin, tmax) => round(Math.max(0, 0.0023 * ((tmin + tmax) / 2 + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * 15), 1);

/* ---------------------------------------------------------------- geocoding */
export async function geocode(q) {
  const name = String(q || '').trim();
  if (!name) return null;
  if (key()) {
    try {
      const r = await getJson(`${OWM}/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=1&appid=${key()}`);
      if (r[0]) return { lat: r[0].lat, lon: r[0].lon, name: r[0].name, country: r[0].country };
    } catch { /* fall through to the free service */ }
  }
  try {
    const r = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`);
    const x = r.results?.[0];
    if (x) return { lat: x.latitude, lon: x.longitude, name: x.name, country: x.country_code };
  } catch { /* nothing found */ }
  return null;
}

/** Where to look at the weather: a chosen point, else the chosen/first farm (a field's GPS, else its place name). */
export async function resolveLocation(userId, { lat, lon, farm_id } = {}) {
  const farms = await Farm.find({ user_id: userId }).lean();
  const options = farms.map((f) => ({ id: String(f._id), name: f.name }));
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { point: { lat, lon, name: null }, options, farm: null };
  const farm = farms.find((f) => String(f._id) === String(farm_id)) || farms[0];
  if (!farm) return { point: null, options, farm: null };
  const field = await Field.findOne({ user_id: userId, farm_id: farm._id, latitude: { $ne: null }, longitude: { $ne: null } }).lean();
  if (field) return { point: { lat: field.latitude, lon: field.longitude, name: farm.name, source: 'field' }, options, farm };
  const parts = [farm.location, farm.district, farm.province, farm.country].filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    const hit = await geocode(parts.slice(i).join(', ')) || (i < parts.length - 1 ? null : await geocode(parts[i]));
    if (hit) return { point: { ...hit, name: farm.name, place: hit.name, source: 'place' }, options, farm };
  }
  return { point: null, options, farm };
}

/* ---------------------------------------------------------------- providers */
async function fromOwm(lat, lon) {
  const [cur, fc] = await Promise.all([
    getJson(`${OWM}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key()}`),
    getJson(`${OWM}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key()}`),
  ]);
  const w = cur.weather?.[0] || {};
  const hourly = fc.list.slice(0, 16).map((x) => ({
    time: new Date(x.dt * 1000).toISOString(), temp: round(x.main.temp), rain_mm: round((x.rain?.['3h'] || 0)), pop: Math.round((x.pop || 0) * 100),
    wind_kph: round(x.wind.speed * 3.6), humidity: x.main.humidity, kind: kindFromOwm(x.weather[0].id), description: x.weather[0].description,
  }));
  const byDay = new Map();
  for (const x of fc.list) {
    const day = new Date((x.dt + (fc.city.timezone || 0)) * 1000).toISOString().slice(0, 10);
    const d = byDay.get(day) || { date: day, tmin: 99, tmax: -99, rain_mm: 0, pop: 0, wind: 0, hum: [], ids: [] };
    d.tmin = Math.min(d.tmin, x.main.temp_min); d.tmax = Math.max(d.tmax, x.main.temp_max);
    d.rain_mm += x.rain?.['3h'] || 0; d.pop = Math.max(d.pop, x.pop || 0); d.wind = Math.max(d.wind, x.wind.speed * 3.6);
    d.hum.push(x.main.humidity); d.ids.push(x.weather[0]);
    byDay.set(day, d);
  }
  const daily = [...byDay.values()].map((d) => {
    const worst = d.ids.reduce((a, b) => (b.id < 800 && (a.id >= 800 || b.id < a.id) ? b : a), d.ids[0]);
    return { date: d.date, tmin: round(d.tmin), tmax: round(d.tmax), rain_mm: round(d.rain_mm), pop: Math.round(d.pop * 100), wind_kph: round(d.wind), humidity: Math.round(d.hum.reduce((a, b) => a + b, 0) / d.hum.length), kind: kindFromOwm(worst.id), description: worst.description, et0: et0From(d.tmin, d.tmax) };
  });
  return {
    provider: 'OpenWeatherMap',
    place: { name: cur.name, country: cur.sys?.country },
    current: {
      temp: round(cur.main.temp), feels: round(cur.main.feels_like), humidity: cur.main.humidity, pressure: cur.main.pressure, wind_kph: round(cur.wind.speed * 3.6),
      wind_dir: cur.wind.deg ?? null, clouds: cur.clouds?.all ?? null, rain_mm: round(cur.rain?.['1h'] || 0), description: w.description || '', kind: kindFromOwm(w.id || 800),
      sunrise: cur.sys?.sunrise ? new Date(cur.sys.sunrise * 1000).toISOString() : null, sunset: cur.sys?.sunset ? new Date(cur.sys.sunset * 1000).toISOString() : null,
    },
    hourly, daily, rain_past_7d_mm: null,
  };
}

async function fromOpenMeteo(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&past_days=7&forecast_days=7`
    + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m'
    + '&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration,sunrise,sunset';
  const r = await getJson(url);
  const c = r.current;
  const today = c.time.slice(0, 10);
  const days = r.daily.time.map((date, i) => ({
    date, tmin: round(r.daily.temperature_2m_min[i]), tmax: round(r.daily.temperature_2m_max[i]), rain_mm: round(r.daily.precipitation_sum[i] || 0),
    pop: r.daily.precipitation_probability_max[i] ?? 0, wind_kph: round(r.daily.wind_speed_10m_max[i]), humidity: null, kind: kindFromWmo(r.daily.weather_code[i]),
    description: WMO[r.daily.weather_code[i]] || '', et0: round(r.daily.et0_fao_evapotranspiration[i]),
  }));
  const past = days.filter((d) => d.date < today);
  const startIdx = r.hourly.time.findIndex((t) => t >= c.time);
  const hourly = [];
  for (let i = startIdx; i < r.hourly.time.length && hourly.length < 16; i += 3) {
    hourly.push({
      time: r.hourly.time[i], temp: round(r.hourly.temperature_2m[i]), rain_mm: round(r.hourly.precipitation.slice(i, i + 3).reduce((a, b) => a + (b || 0), 0)),
      pop: r.hourly.precipitation_probability[i] ?? 0, wind_kph: round(r.hourly.wind_speed_10m[i]), humidity: r.hourly.relative_humidity_2m[i],
      kind: kindFromWmo(r.hourly.weather_code[i]), description: WMO[r.hourly.weather_code[i]] || '',
    });
  }
  const todayRow = days.find((d) => d.date === today);
  return {
    provider: 'Open-Meteo',
    place: { name: null, country: null },
    current: {
      temp: round(c.temperature_2m), feels: round(c.apparent_temperature), humidity: c.relative_humidity_2m, pressure: round(c.pressure_msl, 0), wind_kph: round(c.wind_speed_10m),
      wind_dir: c.wind_direction_10m, clouds: c.cloud_cover, rain_mm: round(c.precipitation), description: WMO[c.weather_code] || '', kind: kindFromWmo(c.weather_code),
      sunrise: r.daily.sunrise[r.daily.time.indexOf(today)] || null, sunset: r.daily.sunset[r.daily.time.indexOf(today)] || null,
    },
    hourly, daily: days.filter((d) => d.date >= today),
    rain_past_7d_mm: round(past.reduce((a, d) => a + (d.rain_mm || 0), 0)),
    _today: todayRow,
  };
}

/** Weather at a point (cached 10 minutes). */
export async function weatherAt(lat, lon) {
  const k = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  let data;
  if (key()) {
    try { data = await fromOwm(lat, lon); } catch { data = null; } // key not active yet, quota, or network: use the free service
  }
  if (!data) data = await fromOpenMeteo(lat, lon);
  delete data._today;
  // the free forecast has no history: borrow the past week of rain from the other service when needed
  if (data.rain_past_7d_mm == null) {
    try { data.rain_past_7d_mm = (await fromOpenMeteo(lat, lon)).rain_past_7d_mm; } catch { /* leave empty */ }
  }
  cache.set(k, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return data;
}

/* ------------------------------------------------------------ water balance */
/**
 * Water the crop needs over the coming days: crop water use (reference evapotranspiration x crop factor)
 * minus the rain that is likely to be useful. Used by the weather page, the calculators and the assistant.
 */
export function waterBalance(weather, { kc = 1, days = 7 } = {}) {
  const next = weather.daily.slice(0, days);
  const et = next.reduce((a, d) => a + (d.et0 ?? et0From(d.tmin, d.tmax)), 0) * kc;
  const rain = next.reduce((a, d) => a + (d.rain_mm || 0) * Math.max(0.3, (d.pop || 0) / 100), 0) * 0.8; // 80% of the expected rain soaks in
  return {
    days: next.length, crop_factor: kc, crop_water_use_mm: round(et), expected_useful_rain_mm: round(rain),
    irrigation_needed_mm: round(Math.max(0, et - rain)), rain_past_7d_mm: weather.rain_past_7d_mm,
  };
}

/** Typical crop factor (mid season) by crop name; 1.0 when unknown. */
const KC = [[/maize|corn|sorghum|millet/i, 1.15], [/rice/i, 1.2], [/bean|soy|pea|groundnut|peanut|cowpea/i, 1.05], [/tomato|pepper|eggplant|cucumber|onion|cabbage|vegetable/i, 1.05],
  [/potato|cassava|sweet potato/i, 1.1], [/banana|plantain/i, 1.1], [/coffee|tea|cocoa/i, 1.0], [/wheat|barley/i, 1.1]];
export const cropFactor = (name = '') => KC.find(([re]) => re.test(name))?.[1] ?? 1;

/* ------------------------------------------------------------------- advice */
const L = { info: 'info', watch: 'watch', warn: 'warn' };
export function adviceFrom(weather, cycles = []) {
  const out = [];
  const add = (level, topic, text, crop) => out.push({ level, topic, text, crop: crop || null });
  const { current: c, daily, hourly } = weather;
  const next3 = daily.slice(0, 3);
  const rain3 = next3.reduce((a, d) => a + (d.rain_mm || 0), 0);
  const heavy = daily.slice(0, 4).find((d) => (d.rain_mm || 0) >= 20);
  const hot = daily.slice(0, 5).find((d) => d.tmax >= 34);
  const cold = daily.slice(0, 5).find((d) => d.tmin <= 3);
  const windy = hourly.slice(0, 4).some((h) => h.wind_kph >= 20);
  const wetSoon = hourly.slice(0, 3).some((h) => (h.pop >= 50) || h.rain_mm >= 1);
  const water = waterBalance(weather);

  if (heavy) add(L.warn, 'Heavy rain', `Heavy rain (${heavy.rain_mm} mm) is expected on ${heavy.date}. Delay fertilizer and spraying, clear drainage channels and protect stored harvest.`);
  if (hot) add(L.warn, 'Heat stress', `Very hot weather (up to ${hot.tmax} °C) on ${hot.date}. Water in the early morning or evening, mulch, and avoid transplanting in the midday heat.`);
  if (cold) add(L.warn, 'Cold / frost', `Low night temperature (${cold.tmin} °C) on ${cold.date}. Cover young and sensitive plants.`);
  if (!windy && !wetSoon) add(L.info, 'Spraying', 'Calm and dry for the next hours: a good window to spray crop protection products, early morning or late afternoon.');
  else add(L.watch, 'Spraying', windy ? 'Wind is strong. Do not spray: the product will drift and be wasted.' : 'Rain is likely within hours. Spraying now would be washed off, wait for a dry spell.');
  if (rain3 >= 15) add(L.watch, 'Fertilizer', `About ${round(rain3)} mm of rain in 3 days can wash nutrients away. Apply fertilizer after the rain, not before.`);
  else if (rain3 < 2) add(L.info, 'Fertilizer', 'Dry days ahead: if you apply fertilizer, water it in or it will not reach the roots.');
  if (water.irrigation_needed_mm >= 10) add(L.watch, 'Irrigation', `Plants will use about ${water.crop_water_use_mm} mm this week and only about ${water.expected_useful_rain_mm} mm of rain is useful. Plan about ${water.irrigation_needed_mm} mm of irrigation.`);
  else add(L.info, 'Irrigation', `Rain should cover most of this week's water need (${water.expected_useful_rain_mm} mm of useful rain against ${water.crop_water_use_mm} mm of crop use). Irrigate only if the soil is dry.`);
  if (c.humidity >= 85 && c.temp >= 15 && c.temp <= 28) add(L.watch, 'Disease risk', 'Warm and humid: leaf diseases such as blight, rust and mildew spread fast. Scout your fields in the next days.');
  if (daily.slice(0, 4).every((d) => (d.rain_mm || 0) < 1) && daily.length) add(L.info, 'Harvest and drying', 'A dry spell is coming: good for harvesting and drying grain, beans and other produce in the field.');

  for (const cy of cycles) {
    const name = cy.crop_name;
    if (!name) continue;
    if (cy.status === 'Ready for Harvest' && rain3 >= 10) add(L.warn, 'Harvest', `${name} is ready and rain is coming (${round(rain3)} mm in 3 days). Harvest before it rains if you can.`, name);
    if (['Planted', 'Growing'].includes(cy.status) && hot) add(L.watch, 'Crop care', `${name}: hot days ahead, check soil moisture in ${cy.field_name || 'the field'}.`, name);
    if (cy.status === 'Planned' && rain3 >= 15) add(L.info, 'Planting', `${name}: soil will be wet after the rain, a good moment to plant if the field can be worked.`, name);
  }
  return out;
}

/** Open crop cycles with the names the advice needs. */
export async function openCycles(userId) {
  const cycles = await CropCycle.find({ user_id: userId, status: { $in: ['Planned', 'Planted', 'Growing', 'Ready for Harvest'] } }).limit(30).lean();
  const [crops, fields] = await Promise.all([Crop.find({ user_id: userId }).lean(), Field.find({ user_id: userId }).lean()]);
  const nm = (l, id) => l.find((x) => String(x._id) === String(id))?.name || null;
  return cycles.map((c) => ({ status: c.status, crop_name: nm(crops, c.crop_id), field_name: nm(fields, c.field_id), planted: c.planting_date, expected_harvest: c.expected_harvest_date }));
}

/** Everything the weather page, the calculators and the assistant need for one user. */
export async function weatherForUser(userId, opts = {}) {
  const loc = await resolveLocation(userId, opts);
  if (!loc.point) return { located: false, farms: loc.options };
  const weather = await weatherAt(loc.point.lat, loc.point.lon);
  const cycles = await openCycles(userId);
  const crops = [...new Set(cycles.map((c) => c.crop_name).filter(Boolean))];
  const kc = crops.length ? crops.map(cropFactor).reduce((a, b) => a + b, 0) / crops.length : 1;
  return {
    located: true,
    farms: loc.options,
    farm_id: loc.farm ? String(loc.farm._id) : opts.farm_id || null,
    location: { name: loc.point.name || weather.place.name, place: loc.point.place || weather.place.name, lat: loc.point.lat, lon: loc.point.lon, country: weather.place.country || loc.point.country || null, source: loc.point.source || 'point' },
    ...weather,
    water: waterBalance(weather, { kc }),
    advice: adviceFrom(weather, cycles),
    crops,
  };
}
