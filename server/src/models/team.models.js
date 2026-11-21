import { ownedSchema, ref } from './_base.js';

/**
 * A job the farm manager hands out. user_id is the farm manager. A task can be for one data collector (assigned_to is their account id) or for
 * everyone on the team (assigned_to is empty); it can point at a field. The assigned collector marks it done; nobody but the manager edits or
 * deletes it.
 */
const TaskSchema = ownedSchema({
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, trim: true, default: '', maxlength: 1000 },
  due_date: { type: String, default: '' }, // YYYY-MM-DD, empty = no date
  priority: { type: String, enum: ['Low', 'Normal', 'High'], default: 'Normal' },
  status: { type: String, enum: ['open', 'done'], default: 'open' },
  assigned_to: { type: String, default: '' }, // a team member's account id; empty = anyone on the team
  assigned_to_name: { type: String, default: '' },
  farm_id: { ...ref('Farm') },
  field_id: { ...ref('Field') },
  done_at: { type: Date, default: null },
  done_by: { type: String, default: '' },
  done_by_name: { type: String, default: '' },
  completion_note: { type: String, trim: true, default: '', maxlength: 500 },
});
TaskSchema.index({ user_id: 1, status: 1, due_date: 1 });

import mongoose from 'mongoose';
export const Task = mongoose.model('Task', TaskSchema);
