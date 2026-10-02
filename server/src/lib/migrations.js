import * as M from '../models/index.js';
import { migrateAccountStatuses } from './accountStatus.js';

/** Every model whose records carry money values (and therefore a `currency`). */
export const MONEY_MODELS = [
  M.Expense, M.Sale, M.PlantingRecord, M.FieldActivity, M.IrrigationRecord, M.FertilizerApplication,
  M.CropProtectionRecord, M.HarvestRecord, M.InventoryItem, M.Equipment, M.EquipmentMaintenance,
];

/**
 * Records saved before each record had its own currency get their owner's default
 * currency (USD when the owner has none). Safe to run on every start.
 */
export async function migrateRecordCurrencies() {
  const missing = { $or: [{ currency: { $exists: false } }, { currency: null }, { currency: '' }] };
  let n = 0;
  for (const Model of MONEY_MODELS) {
    const owners = await Model.distinct('user_id', missing);
    if (!owners.length) continue;
    const profiles = await M.Profile.find({ user_id: { $in: owners } }, 'user_id currency').lean();
    const currencyOf = Object.fromEntries(profiles.map((p) => [p.user_id, p.currency || 'USD']));
    for (const userId of owners) {
      const r = await Model.updateMany({ user_id: userId, ...missing }, { $set: { currency: currencyOf[userId] || 'USD' } });
      n += r.modifiedCount || 0;
    }
  }
  if (n) console.log(`[migrate] set currency on ${n} existing record(s)`);
}

export async function runMigrations() {
  await migrateAccountStatuses();
  await migrateRecordCurrencies();
}
