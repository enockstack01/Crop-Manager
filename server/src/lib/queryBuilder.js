/**
 * Translate the query-string conventions used by the frontend list views
 * (?page, ?perPage, ?sort, ?order, ?q, plus per-resource equality filters)
 * into a Mongo filter / sort / pagination triple.
 */
export function buildQuery(reqQuery, resource, userId) {
  const filter = { user_id: userId };

  // equality filters declared by the resource
  for (const key of resource.filters || []) {
    const raw = reqQuery[key];
    if (raw !== undefined && raw !== '' && raw !== 'all') filter[key] = raw;
  }

  // free-text search across the resource's searchable fields
  const q = (reqQuery.q || '').trim();
  if (q && (resource.search || []).length) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = resource.search.map((f) => ({ [f]: rx }));
  }

  // sorting
  const sortField = reqQuery.sort || resource.defaultSort || 'created_at';
  const sortDir = reqQuery.order === 'asc' ? 1 : reqQuery.order === 'desc' ? -1 : (resource.defaultOrder === 'asc' ? 1 : -1);
  const sort = { [sortField]: sortDir };

  // pagination
  const page = Math.max(1, parseInt(reqQuery.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(reqQuery.perPage, 10) || 10));

  return { filter, sort, page, perPage, skip: (page - 1) * perPage, limit: perPage };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
