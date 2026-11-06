/**
 * Translate the query-string conventions used by the frontend list views
 * (?page, ?perPage, ?sort, ?order, ?q, plus per-resource equality filters)
 * into a Mongo filter / sort / pagination triple.
 */
// the apps' pickers ask for 1000 rows at once; this is the most one request may return
export const MAX_PER_PAGE = 1000;

export function buildQuery(reqQuery, resource, userId) {
  const filter = { user_id: userId };

  // equality filters declared by the resource
  for (const key of resource.filters || []) {
    const raw = reqQuery[key];
    if (typeof raw === 'string' && raw !== '' && raw !== 'all') filter[key] = raw; // text only: never an operator object
  }

  // free-text search across the resource's searchable fields
  const q = String(reqQuery.q ?? '').trim().slice(0, 100);
  if (q && (resource.search || []).length) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = resource.search.map((f) => ({ [f]: rx }));
  }

  // sorting
  const asked = typeof reqQuery.sort === 'string' && /^[a-z][a-z0-9_]{0,40}$/i.test(reqQuery.sort) ? reqQuery.sort : '';
  const sortField = asked || resource.defaultSort || 'created_at';
  const sortDir = reqQuery.order === 'asc' ? 1 : reqQuery.order === 'desc' ? -1 : (resource.defaultOrder === 'asc' ? 1 : -1);
  const sort = { [sortField]: sortDir };

  // pagination
  const page = Math.max(1, parseInt(reqQuery.page, 10) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(reqQuery.perPage, 10) || 10));

  return { filter, sort, page, perPage, skip: (page - 1) * perPage, limit: perPage };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
