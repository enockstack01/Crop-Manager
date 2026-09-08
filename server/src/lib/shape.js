/**
 * Relation reshaping.
 *
 * The original Supabase client returned embedded relations under the *table* name, e.g.
 *   crop_cycles.select('*, farms(name), fields(name), crops(name)')
 *     -> { farm_id: 'uuid', farms: { name: '...' }, ... }
 *
 * Mongoose populate puts the related document on the *foreign-key* path instead
 * (`farm_id` becomes an object). These helpers restore the original shape so the
 * ported frontend keeps working unchanged: the FK path stays a plain id string and
 * the related fields appear under a sibling alias.
 *
 * A reshape config is a list of:
 *   { from: 'farm_id', to: 'farms', fields: ['name'], children: [ ...same shape ] }
 */

export function toPopulate(config = []) {
  return config.map((entry) => {
    const spec = { path: entry.from };
    const select = new Set(entry.fields || []);
    if (entry.children) entry.children.forEach((c) => select.add(c.from));
    if (select.size) spec.select = [...select].join(' ');
    if (entry.children) spec.populate = toPopulate(entry.children);
    return spec;
  });
}

export function reshape(doc, config = []) {
  if (!doc) return doc;
  for (const entry of config) {
    const sub = doc[entry.from];
    if (sub && typeof sub === 'object') {
      if (entry.children) reshape(sub, entry.children);
      const alias = {};
      for (const f of entry.fields || []) alias[f] = sub[f];
      // carry the child aliases up too (e.g. crop_cycles.crops)
      for (const c of entry.children || []) if (sub[c.to] !== undefined) alias[c.to] = sub[c.to];
      alias.id = sub._id ? sub._id.toString() : sub.id;
      doc[entry.to] = alias;
      doc[entry.from] = alias.id;
    } else if (sub && sub.toString) {
      doc[entry.from] = sub.toString();
    }
  }
  return doc;
}

export function reshapeMany(docs, config = []) {
  return (docs || []).map((d) => reshape(d, config));
}
