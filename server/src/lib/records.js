import { serialize } from './serialize.js';
import { reshapeMany, toPopulate } from './shape.js';
import { resourceByPath } from '../resources.js';

/**
 * Loads one user's records of a resource with their relations resolved to names (farm, field, crop...),
 * in the same shape the API and the dashboard use. `filter` narrows by field values, `sort` and `limit`
 * as in Mongoose.
 */
export function recordLoader(path, { sort, limit, filter = {} } = {}) {
  const resource = resourceByPath[path];
  if (!resource) throw new Error(`Unknown resource: ${path}`);
  const relations = resource.relations || [];
  const populate = toPopulate(relations);
  return async (user_id) => {
    let query = resource.model.find({ user_id, ...filter });
    if (sort) query = query.sort(sort);
    if (limit) query = query.limit(limit);
    if (populate.length) query = query.populate(populate);
    const rows = await query.lean();
    return reshapeMany(serialize(rows), relations);
  };
}
