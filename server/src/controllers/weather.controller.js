import { asyncHandler } from '../lib/asyncHandler.js';
import createHttpError from '../lib/httpError.js';
import { weatherForUser, geocode } from '../lib/weather.js';

const num = (v) => (v === undefined || v === '' ? NaN : Number(v));

/** GET /api/weather?farm_id=&lat=&lon=  Weather, farm-specific advice and the water balance for a farm. */
export const getWeather = asyncHandler(async (req, res) => {
  const data = await weatherForUser(req.userId, { farm_id: req.query.farm_id, lat: num(req.query.lat), lon: num(req.query.lon) });
  res.json(data);
});

/** GET /api/weather/geocode?q=  Find a place by name (to set a custom point). */
export const findPlace = asyncHandler(async (req, res) => {
  const hit = await geocode(String(req.query.q || '').slice(0, 80));
  if (!hit) throw createHttpError(404, 'Place not found.');
  res.json(hit);
});

/** The tool the assistant calls to see the weather and the water balance on the farmer's land. */
export function weatherTool(userId) {
  return {
    tools: [{
      name: 'get_weather',
      description: 'Current weather, the next days of forecast, rain of the past week, the water balance (crop water use against useful rain) and rule-based advice for the farmer\'s farm. Use it for questions about rain, irrigation, spraying, planting or harvesting timing.',
      input_schema: { type: 'object', properties: { farm_id: { type: 'string', description: 'Optional farm id; the first farm is used otherwise' } } },
    }],
    handlers: {
      get_weather: async (input) => {
        const w = await weatherForUser(userId, { farm_id: input?.farm_id });
        if (!w.located) return { error: 'No farm location is known. Ask the farmer to add a farm location.' };
        return { location: w.location, current: w.current, next_days: w.daily.slice(0, 7), rain_past_7d_mm: w.rain_past_7d_mm, water_balance: w.water, advice: w.advice };
      },
    },
  };
}
