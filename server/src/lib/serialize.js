/**
 * Turn a lean Mongoose doc (or array/tree of them) into a plain JSON-safe object
 * where every `_id` becomes a string `id`, ObjectIds become strings and Dates
 * become ISO strings. Mirrors the model `toJSON` transform for `.lean()` results.
 */
export function serialize(input) {
  return fix(JSON.parse(JSON.stringify(input)));
}

function fix(value) {
  if (Array.isArray(value)) return value.map(fix);
  if (value && typeof value === 'object') {
    if (value._id !== undefined && value.id === undefined) {
      value.id = value._id;
    }
    delete value._id;
    delete value.__v;
    for (const key of Object.keys(value)) value[key] = fix(value[key]);
    return value;
  }
  return value;
}
