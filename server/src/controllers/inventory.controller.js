import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serialize } from '../lib/serialize.js';
import { InventoryItem, InventoryTransaction } from '../models/index.js';

/**
 * Stock in / out — updates the item quantity and records a transaction,
 * matching the stock modal in the original inventory.js.
 * body: { type: 'in' | 'out', quantity, notes }
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { type, quantity, notes } = req.body;
  const qty = Number(quantity) || 0;
  if (!['in', 'out'].includes(type)) throw createHttpError(400, 'type must be "in" or "out"');
  if (qty <= 0) throw createHttpError(400, 'quantity must be greater than zero');

  const item = await InventoryItem.findOne({ _id: req.params.id, user_id: req.userId });
  if (!item) throw createHttpError(404, 'Inventory item not found');

  const previous = item.current_quantity || 0;
  const next = type === 'in' ? previous + qty : Math.max(0, previous - qty);
  item.current_quantity = next;
  await item.save();

  const txn = await InventoryTransaction.create({
    user_id: req.userId,
    item_id: item._id,
    transaction_type: type === 'in' ? 'Stock In' : 'Stock Out',
    quantity: qty,
    previous_quantity: previous,
    new_quantity: next,
    notes: notes || '',
  });

  res.status(201).json({ item: serialize(item.toObject()), transaction: serialize(txn.toObject()) });
});
