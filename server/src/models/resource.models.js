import mongoose from 'mongoose';
import { ownedSchema, ref } from './_base.js';

const InventoryItemSchema = ownedSchema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  unit: { type: String, default: 'kg' },
  current_quantity: { type: Number, default: 0 },
  minimum_stock: { type: Number, default: 0 },
  unit_cost: { type: Number, default: 0 },
  supplier: { type: String, trim: true },
  expiry_date: { type: String, default: null },
  storage_location: { type: String, trim: true },
  notes: { type: String, trim: true },
});

const InventoryTransactionSchema = ownedSchema({
  item_id: { ...ref('InventoryItem'), required: true, index: true },
  transaction_type: { type: String, required: true },
  quantity: { type: Number, required: true },
  previous_quantity: { type: Number, default: 0 },
  new_quantity: { type: Number, default: 0 },
  notes: { type: String, trim: true },
});

const EquipmentSchema = ownedSchema({
  name: { type: String, required: true, trim: true },
  equipment_type: { type: String, trim: true },
  model: { type: String, trim: true },
  serial_number: { type: String, trim: true },
  purchase_date: { type: String, default: null },
  purchase_cost: { type: Number, default: 0 },
  condition: { type: String, trim: true },
  location: { type: String, trim: true },
  status: { type: String, default: 'Available' },
  notes: { type: String, trim: true },
});

const EquipmentMaintenanceSchema = ownedSchema({
  equipment_id: { ...ref('Equipment'), default: null, index: true },
  maintenance_date: { type: String, required: true },
  type: { type: String, trim: true },
  description: { type: String, trim: true },
  cost: { type: Number, default: 0 },
  performed_by: { type: String, trim: true },
  next_maintenance: { type: String, default: null },
  notes: { type: String, trim: true },
});

export const InventoryItem = mongoose.model('InventoryItem', InventoryItemSchema);
export const InventoryTransaction = mongoose.model('InventoryTransaction', InventoryTransactionSchema);
export const Equipment = mongoose.model('Equipment', EquipmentSchema);
export const EquipmentMaintenance = mongoose.model('EquipmentMaintenance', EquipmentMaintenanceSchema);
