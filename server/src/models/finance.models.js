import mongoose from 'mongoose';
import { ownedSchema, ref } from './_base.js';
import { currencyField } from '../lib/currencies.js';

const ExpenseSchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  farm_id: { ...ref('Farm'), default: null, index: true },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  category: { type: String, required: true },
  description: { type: String, trim: true },
  amount: { type: Number, default: 0 },
  expense_date: { type: String, required: true, index: true },
  payment_method: { type: String, trim: true },
  supplier: { type: String, trim: true },
  notes: { type: String, trim: true },
});

const SaleSchema = ownedSchema({
  currency: currencyField, // money values in this record are in this currency
  farm_id: { ...ref('Farm'), default: null, index: true },
  crop_id: { ...ref('Crop'), required: true, index: true },
  crop_cycle_id: { ...ref('CropCycle'), default: null },
  buyer: { type: String, trim: true },
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'kg' },
  unit_price: { type: Number, default: 0 },
  total_amount: { type: Number, default: 0 },
  sale_date: { type: String, required: true, index: true },
  market: { type: String, trim: true },
  payment_status: { type: String, default: 'Pending' },
  notes: { type: String, trim: true },
});
const saleTotal = (d) => (d.quantity || 0) * (d.unit_price || 0);
SaleSchema.pre('save', function computeTotal(next) {
  this.total_amount = saleTotal(this);
  next();
});
SaleSchema.pre('insertMany', function (next, docs) {
  docs.forEach((d) => { d.total_amount = saleTotal(d); });
  next();
});

export const Expense = mongoose.model('Expense', ExpenseSchema);
export const Sale = mongoose.model('Sale', SaleSchema);
