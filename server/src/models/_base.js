import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Shared conventions for every collection:
 *  - `user_id` (Clerk user id string) scopes every document to its owner
 *  - snake_case `created_at` / `updated_at` timestamps (kept identical to the original schema)
 *  - JSON output exposes `id` instead of `_id` and hides `__v`
 */
export function ownedSchema(definition, options = {}) {
  const schema = new Schema(
    {
      // indexed via the compound index below (and per-model unique index where needed)
      user_id: { type: String, required: true },
      ...definition,
    },
    {
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
      toJSON: { virtuals: true, versionKey: false, transform: transformDoc },
      toObject: { virtuals: true, versionKey: false, transform: transformDoc },
      ...options,
    }
  );

  // Common access pattern: "my rows, newest first"
  schema.index({ user_id: 1, created_at: -1 });
  return schema;
}

function transformDoc(_doc, ret) {
  ret.id = ret._id?.toString?.() ?? ret._id;
  delete ret._id;
  return ret;
}

export const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model });
export { Schema };
