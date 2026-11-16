import { asyncHandler } from '../lib/asyncHandler.js';
import createHttpError from '../lib/httpError.js';
import { weatherForUser, geocode } from '../lib/weather.js';

const num = (v) => (v === undefined || v === '' ? NaN : Number(v));

/** GET /api/weather?field_id=  Weather at the exact point of a field, advice for its crops and the water balance. (farm_id picks the first field of a farm; lat and lon are kept for older apps.) */
export const getWeather = asyncHandler(async (req, res) => {
  const data = await weatherForUser(req.userId, { farm_id: req.query.farm_id, field_id: req.query.field_id, lat: num(req.query.lat), lon: num(req.query.lon) });
  res.json(data);
});

/** GET /api/weather/geocode?q=  Find a place by name (to set a custom point). */
export const findPlace = asyncHandler(async (req, res) => {
  const hit = await geocode(String(req.query.q || '').slice(0, 80));
  if (!hit) throw createHttpError(404, 'Place not found.');
  res.json(hit);
});

/** The tool the assistant calls to see the weather and the water balance on the farmer's land. */
export function weatherTool(userId, here) {
  return {
    tools: [{
      name: 'get_weather',
      description: 'Current weather, the next days of forecast, rain of the past week, the water balance (crop water use against useful rain) and rule-based advice at the exact coordinates of one of the farmer\'s fields. Use it for questions about rain, irrigation, spraying, planting or harvesting timing.',
      input_schema: { type: 'object', properties: { field_id: { type: 'string', description: 'Optional field id; the first field that has coordinates is used otherwise' } } },
    }],
    handlers: {
      get_weather: async (input) => {
        const w = await weatherForUser(userId, input?.field_id ? { field_id: input.field_id } : {});
        if (!w.located) return { error: 'No field has coordinates yet. Ask the farmer to add the exact coordinates of a field.' };
        return { location: w.location, current: w.current, next_days: w.daily.slice(0, 7), rain_past_7d_mm: w.rain_past_7d_mm, water_balance: w.water, advice: w.advice };
      },
    },
  };
}
