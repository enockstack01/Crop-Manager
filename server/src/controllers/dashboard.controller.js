import { asyncHandler } from '../lib/asyncHandler.js';
import { serialize } from '../lib/serialize.js';
import { recordLoader } from '../lib/records.js';
import * as M from '../models/index.js';

const loader = (path, opts) => recordLoader(path, opts);

/**
 * Mirrors dashboard.js:loadAllData() — the eleven datasets the dashboard aggregates
 * client-side, scoped to the current user, fetched in parallel.
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const uid = req.userId;

  const [farms, fields, crops, seasons, cycles, harvests, activities, scouting, expenses, sales, inventory] =
    await Promise.all([
      M.Farm.find({ user_id: uid }).lean(),
      loader('fields')(uid),
      M.Crop.find({ user_id: uid }).lean(),
      M.Season.find({ user_id: uid }).sort({ name: 1 }).lean(),
      loader('crop-cycles')(uid),
      loader('harvest-records', { sort: { harvest_date: -1 } })(uid),
      loader('field-activities', { sort: { activity_date: -1 }, limit: 300 })(uid), // 12-week activity chart
      loader('crop-scouting-records', { sort: { scouting_date: -1 }, limit: 20 })(uid),
      M.Expense.find({ user_id: uid }).lean(),
      loader('sales')(uid),
      M.InventoryItem.find({ user_id: uid }).lean(),
    ]);

  res.json({
    farms: serialize(farms),
    fields,
    crops: serialize(crops),
    seasons: serialize(seasons),
    cycles,
    harvests,
    activities,
    scouting,
    expenses: serialize(expenses),
    sales,
    inventory: serialize(inventory),
  });
});
