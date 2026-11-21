import createHttpError from './httpError.js';
import { asyncHandler } from './asyncHandler.js';
import { buildQuery } from './queryBuilder.js';
import { toPopulate, reshapeMany, reshape } from './shape.js';
import { serialize } from './serialize.js';
import mongoose from 'mongoose';

/**
 * Every link to another record (farm_id, field_id, crop_id ...) is read from the schema. A link in a request body must point at a
 * record the same user owns, so nobody can attach their data to another farmer's farm, field or crop by guessing an id.
 */
function refFields(Model) {
  const out = [];
  Model.schema.eachPath((path, type) => {
    if (path !== 'user_id' && type.options && type.options.ref) out.push({ path, model: type.options.ref });
  });
  return out;
}

async function assertOwnLinks(fields, body, userId) {
  for (const { path, model } of fields) {
    const value = body[path];
    if (value === undefined || value === null || value === '') continue; // empty optional link
    if (!mongoose.isValidObjectId(value)) throw createHttpError(400, `${path} is not a valid link`);
    const found = await mongoose.model(model).exists({ _id: value, user_id: userId });
    if (!found) throw createHttpError(400, `${path} does not match one of your records`);
  }
}

/**
 * Build a set of REST handlers for one resource from its declarative config
 * (see resources.js). Every query is scoped to the authenticated user.
 */
export function crudController(resource) {
  const Model = resource.model;
  const populate = toPopulate(resource.relations || []);
  const hasCurrency = !!Model.schema.path('currency');
  const links = refFields(Model);

  const readOne = async (id, userId) => {
    let query = Model.findOne({ _id: id, user_id: userId });
    if (populate.length) query = query.populate(populate);
    const doc = await query.lean();
    if (!doc) throw createHttpError(404, `${resource.name} not found`);
    return reshape(serialize(doc), resource.relations || []);
  };

  return {
    list: asyncHandler(async (req, res) => {
      const { filter, sort, page, perPage, skip, limit } = buildQuery(req.query, resource, req.userId);
      let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
      if (populate.length) query = query.populate(populate);
      const [rows, total] = await Promise.all([
        query.lean(),
        Model.countDocuments(filter),
      ]);
      res.json({
        data: reshapeMany(serialize(rows), resource.relations || []),
        page,
        perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      });
    }),

    getOne: asyncHandler(async (req, res) => {
      res.json(await readOne(req.params.id, req.userId));
    }),

    create: asyncHandler(async (req, res) => {
      const body = stripReadOnly(req.body);
      // money records default to the owner's default currency (Settings)
      if (hasCurrency && !body.currency) body.currency = req.profile?.currency || 'USD';
      await assertOwnLinks(links, body, req.userId);
      assertValid(resource, body);
      // every record says who entered it: the farm manager or the data collector (the name is theirs, taken from their account)
      const doc = new Model({ ...body, user_id: req.userId, recorded_by: req.actorId || req.userId, recorded_by_name: req.profile?.full_name || req.profile?.email || '' });
      await doc.save();
      res.status(201).json(await readOne(doc._id, req.userId));
    }),

    update: asyncHandler(async (req, res) => {
      const doc = await Model.findOne({ _id: req.params.id, user_id: req.userId });
      if (!doc) throw createHttpError(404, `${resource.name} not found`);
      // a data collector edits only the entries they made, never a colleague's or the farm manager's
      if (req.farmRole === 'collector' && doc.recorded_by !== req.actorId) throw createHttpError(403, 'You can edit only the entries you recorded.', { code: 'collector_not_yours' });
      const body = stripReadOnly(req.body);
      if (hasCurrency && !body.currency) delete body.currency; // keep the record's currency
      await assertOwnLinks(links, body, req.userId);
      assertValid(resource, { ...doc.toObject(), ...body }); // the record as it will be after this change
      doc.set(body);
      await doc.save();
      res.json(await readOne(doc._id, req.userId));
    }),

    remove: asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
      if (!doc) throw createHttpError(404, `${resource.name} not found`);
      res.json({ id: req.params.id, deleted: true });
    }),

    readOne,
  };
}

/** A resource can carry its own rule (resources.js `validate`): it returns a message when the record must not be saved. */
function assertValid(resource, record) {
  const message = resource.validate?.(record);
  if (message) throw createHttpError(400, message, { code: 'invalid_record' });
}

function stripReadOnly(body = {}) {
  const clone = { ...body };
  for (const k of ['_id', 'id', 'user_id', 'created_at', 'updated_at', '__v', 'recorded_by', 'recorded_by_name']) delete clone[k];
  return clone;
}
